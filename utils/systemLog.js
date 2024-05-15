const fs = require('fs');
const path = require('path');

const systemLog = (message) => {
    // message: Object
    const logPath = path.join(__dirname, '../backend.log'); // 指定日志文件的路径
    const logMessage = JSON.stringify({
        'time': new Date().toISOString(),
        ...message,
    }, 4) + '\n';

    // 以追加模式写入文件
    fs.appendFile(logPath, logMessage, (err) => {
        if (err) {
            console.error('写入日志文件出错:', err);
        }
    });
}

module.exports = { systemLog };