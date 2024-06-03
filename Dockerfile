FROM node:18.16

ADD package.json /var/DocTranslate_Backend/package.json
WORKDIR /var/DocTranslate_Backend
RUN npm install

COPY . /var/DocTranslate_Backend

EXPOSE 3000
ENTRYPOINT [ "node", "/var/DocTranslate_Backend/bin/www" ]