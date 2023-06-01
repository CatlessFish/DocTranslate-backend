FROM node:18.16

ADD package.json /var/coco/package.json
WORKDIR /var/coco
RUN npm install

COPY . /var/coco

EXPOSE 3000
ENTRYPOINT [ "node", "/var/coco/bin/www" ]