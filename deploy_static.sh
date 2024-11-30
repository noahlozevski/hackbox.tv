#!/bin/bash

cp -R /home/noahlozevski/app/site/* /var/www/hackbox_site/
sudo chown -R www-data:www-data /var/www/hackbox_site
sudo chmod -R 755 /var/www/hackbox_site

