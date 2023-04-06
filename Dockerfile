FROM node:18.15.0
WORKDIR /
COPY . /var/coco
EXPOSE 3000
ENTRYPOINT [ "node", "/var/coco/bin/www" ]