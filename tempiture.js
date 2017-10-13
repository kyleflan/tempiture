var graphite = require('graphite');
var mcpadc = require('mcp-spi-adc');
var fs = require('fs');
var jsmin = require('jsmin').jsmin;
var ArgumentParser = require('argparse').ArgumentParser;
var parser = new ArgumentParser({
	version: '0.0.4',
	addHelp: true,
	description: 'index.js is the main brains behind the tempiture system. It is the hardware interface to measure the probe temperatures as well as the coordinator to write the probe metric information to Graphite.'
});

/* Set up arg parsing */
parser.addArgument(
	[ '-l', '--enable-logging', '--verbose' ],
	{ help: 'Enable verbose logging.',
		required: false,
		action: 'storeTrue',
		dest: 'ENABLE_LOGGING',
		defaultValue: false});

parser.addArgument(
	[ '--graphite-server' ],
	{ help: 'Hostname or IP address of Graphite server.',
		required: false,
		dest: 'GRAPHITE_SERVER',
		defaultValue: 'graphite'});

parser.addArgument(
	[ '--graphite-port' ],
	{ help: 'Graphite server port.',
		required: false,
		dest: 'GRAPHITE_PORT',
		defaultValue: '2003'});

parser.addArgument(
	[ '--probe-config-file', '-p' ],
	{ help: 'Path the JSON file containing the probes configuration information. Default: probes.json',
		required: false,
		dest: 'PROBES_CONFIG_PATH',
		defaultValue: 'probes.json'});

var args = parser.parseArgs();
/* END set up arg parsing */

function console_log(msg) {
	if (args.ENABLE_LOGGING) {
		console.log(msg);
	}
};

/* Load probes configuration */
var probe_file = fs.readFileSync(args.PROBES_CONFIG_PATH, 'utf8');
var json_str = jsmin(probe_file.toString());
var probes = JSON.parse(json_str);
console_log('Parsed probes configuration: ' + probes);

/* Graphite setup */
var graphite_path = 'plaintext://' + args.GRAPHITE_SERVER + ':' + args.GRAPHITE_PORT + '/';
console_log("Graphite URL: " + graphite_path);
var graphite_client = graphite.createClient(graphite_path);
/* END Graphite setup */

// SPI Settings
var SPEED_HZ=20000;
var VOLTAGE=3.3;

console_log("Starting");

function init() {
    for (var i = 0; i < probes.length; i++) {
		p = probes[i]; 
		// calculate temp using Steinhart-Hart equatino
		var L1 = Math.log(p.calibration_resistances[0]);
		var L2 = Math.log(p.calibration_resistances[1]);
		var L3 = Math.log(p.calibration_resistances[2]);
		var Y1 = 1/p.calibration_temps[0];
		var Y2 = 1/p.calibration_temps[1];
		var Y3 = 1/p.calibration_temps[2];
		var gma2 = (Y2-Y1)/(L2-L1);
		var gma3 = (Y3-Y1)/(L3-L1);

		// A, B, and C are variables used in the Steinhart-Hart equation
		// to determine temperature from resistance in a thermistor. These
		// values will be set during the init() function.
		let C = ((gma3-gma2)/(L3-L2))*Math.pow((L1+L2+L3), -1)
		let B = gma2 - C * (Math.pow(L1, 2)+L1*L2+Math.pow(L2,2));
		let A = Y1 - (B+Math.pow(L1, 2)*C)*L1;

		p.resistanceToTemperature = function(R) {
			return 1/(A+B*Math.log(R)+C*Math.pow(Math.log(R),3));
		};
		p.adcToResistance = function (adc_value) {
			// Returns resistance based on the ADC value
			return (this.R / ((1023/adc_value)-1));
		};
		p.convertADCValueToTemp = function (adc_value){
		    // get the Kelvin temperature
		    //var r = adcToResistance(adc_value, p.R);
		    let r = this.adcToResistance(adc_value);
		    let tempK = this.resistanceToTemperature(r);

		    // convert to Celsius and round to 1 decimal place
		    let tempC = tempK - 273.15;
		    tempC = Math.round(tempC*10)/10;

		    // get the Fahrenheit temperature, rounded
		    let tempF = (tempC * 1.8) + 32;
		    tempF = Math.round(tempF*10)/10;

			console_log("ADC Value of probe " + this.name + " is: " + adc_value);
			console_log("Resistance of probe " + this.name + " is: " + r);
			console_log("Temp of probe " + this.name + " is: " + tempF);

			// graphite metric object to send to graphite database
			let probe_data = {
				'data': {
					[this.name.replace(/ /g, '_')]: {
						'adc_value': adc_value,
						'resistance': r,
						'temperature': tempF,
						'tempF': tempF,
						'tempK': tempK,
						'tempC': tempC
					}
				}
			};

			// write to graphite db
			graphite_client.write(probe_data, function(err) {
				if (!err === null) {
					console.log("Failed to write metrics to the metrics server. err: " + err)
				} 
			});

		    // return all three temperature scales
		    return {
				K: tempK,
				C: tempC,
				F: tempF
		    };
		};
    }
	console_log("Probes initialized.");

};

init();

//TODO: CLASSify this
function convertADCValueToTemp(adc_value, p){
    var tempK, tempC, tempF;

    // get the Kelvin temperature
    //var r = adcToResistance(adc_value, p.R);
    var r = p.adcToResistance(adc_value);
    tempK = p.resistanceToTemperature(r);

    // convert to Celsius and round to 1 decimal place
    tempC = tempK - 273.15;
    tempC = Math.round(tempC*10)/10;

    // get the Fahrenheit temperature, rounded
    tempF = (tempC * 1.8) + 32;
    tempF = Math.round(tempF*10)/10;

	console_log("ADC Value of probe " + p.name + " is: " + adc_value);
	console_log("Resistance of probe " + p.name + " is: " + r);
	console_log("Temp of probe " + p.name + " is: " + tempF);

	// graphite metric object to send to graphite database
	var probe_data = {
		'data': {
			[p.name.replace(/ /g, '_')]: {
				'adc_value': adc_value,
				'resistance': r,
				'temperature': tempF,
				'tempF': tempF,
				'tempK': tempK,
				'tempC': tempC
			}
		}
	};

	// write to graphite db
	graphite_client.write(probe_data, function(err) {
		if (!err === null) {
			console_log("Failed to write metrics to the metrics server. err: " + err)
		} 
	});

    // return all three temperature scales
    return {
		K: tempK,
		C: tempC,
		F: tempF
    };
};


console.log(probes[0]);
console.log(probes[0].adcToResistance(900));
console.log(probes[0].resistanceToTemperature(1152000));
//console.log(getTempFromResistance(1152000, probes[0]));
//console.log(probes[1].resistanceToTemperature(1152000));
//console.log(getTempFromResistance(1152000, probes[1]));

// main loop
for (let i = 0; i < probes.length; ++i) {
		(function(probe) {
				var tempSensor = mcpadc.open(probe.channel, {speedHz: SPEED_HZ}, function (err) {
					if (err) {throw err;}

					setInterval(function() {
						tempSensor.read(function(err, reading) {
							if (err) { throw err;}
							
							// get an average reading
							raw_reading = (reading.rawValue);
							probe.adc_vals.push(raw_reading);
							var SAMPLES = 100; // avg 100 samples to get a good reading
							if (probe.adc_vals.length == SAMPLES)
							{
								var sum = probe.adc_vals.reduce(function(acc, val) { return acc + val;}, 0);
								var avg = Math.floor(sum / SAMPLES);
								probe.adc_vals = []; // reset adc_vals queue
								currentTemp = probe.convertADCValueToTemp(avg);
								probe.temp = currentTemp[probe.temp_unit];
							}
						});
					}, 10); // repeat interval every 10 ms
				});
		})(probes[i]);
}
