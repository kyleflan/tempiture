#!/usr/bin/bash
PI_USER=pi

# enable SPI on the pi
sed -i -e 's/#dtparam=spi=on/dtparam=spi=on/' /boot/config.txt

# install node and npm
curl -sL https://deb.nodesource.com/setup_6.x | bash -
apt-get install -y nodejs

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
docker-compose -f ./docker/docker-compose.yml -p tempiture up

# create data source on grafana
chmod +x ./grafana-create-datasource.curl
sudo -u $PI_USER ./grafana-create-datasource.curl

# create dashboard
chmod +x ./grafana-create-dashboard.curl
sudo -u $PI_USER ./grafana-create-dashboard.curl
