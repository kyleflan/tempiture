#!/bin/bash
PI_USER=pi

# enable SPI on the pi
sed -i -e 's/#dtparam=spi=on/dtparam=spi=on/' /boot/config.txt

# install node and npm
curl -sL https://deb.nodesource.com/setup_6.x | bash -
apt-get install -y nodejs

# install jq for parsing jquery on command line
apt-get -y install jq

# install python-pip
apt-get -y install python-pip 

# install docker-compose
pip install docker-compose

# install docker-hypriot, a version of docker for ARM processors
# get gpg key
wget -q https://packagecloud.io/gpg.key -O - | apt-key add -
# add source to apt repo list
echo 'deb https://packagecloud.io/Hypriot/Schatzkiste/debian/ jessie main' | tee /etc/apt/sources.list.d/hypriot.list
# install docker-hypriot
apt-get update
apt-get install -y docker-hypriot
systemctl enable docker
usermod -aG docker $PI_USER
##newgrp docker

# install pm2
npm install pm2@latest -g

# clone git repo
sudo -u $PI_USER git clone https://github.com/kyleflan/tempiture
sudo -u $PI_USER cd ./tempiture

# install index.js...this gets all node packages necessary for tempiture
sudo -u $PI_USER npm install

# start docker containers
eval "docker-compose -f ./docker/docker-compose.yml -p tempiture up" &>/dev/null &disown

# create data source on grafana
sudo -u $PI_USER /bin/bash ./setup-files/grafana-create-datasource.curl

# create dashboard
sudo -u $PI_USER /bin/bash ./setup-files/grafana-create-dashboard.curl

echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
# set default dashboard
sudo -u $PI_USER /bin/bash ./setup-files/grafana-set-default-dashboard.curl
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"

# start pm2
sudo -u $PI_USER pm2 start tempiture.js
sudo -u $PI_USER pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $PI_USER --hp /home/$PI_USER

echo "********************************************************************************"
echo "********************************************************************************"
echo ""
echo "The setup has completed. You should change the admin password for your Grafana " 
echo "instance by logging in to http://localhost:3000/login and then choosing Menu -> "
echo "Admin -> Global Users -> admin -> edit."
echo ""
echo "********************************************************************************"
echo "********************************************************************************"
