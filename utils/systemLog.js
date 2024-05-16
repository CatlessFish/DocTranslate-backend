const fs = require('fs');
const path = require('path');

const systemLog = (message) => {
    // message: Object
    const logPath = path.join(__dirname, '../backend.log'); // 指定日志文件的路径
    const logMessage = JSON.stringify({
        'time': new Date().toISOString(),
        ...message,
    }, 4) + '\n\n';

    // 以追加模式写入文件
    fs.appendFile(logPath, logMessage, (err) => {
        if (err) {
            console.error('写入日志文件出错:', err);
        }
    });
}

const logToFile = (...args) => {
    const logPath = path.join(__dirname, '../console.log');
    const logMessage = args.map((arg) => {
        try {
            return JSON.stringify(arg);
        } catch (e) {

        }
    }).join(' ');
    fs.appendFile(logPath, logMessage + '\n\n', (err) => {
        if (err) {
            console.error('写入日志文件出错:', err);
        }
    });
}
const fileAsConsole = {
    debug: logToFile,
    log: logToFile,
    error: logToFile,
}

module.exports = { systemLog, fileAsConsole };