class GeneralResponse {
    constructor(code, message, data) {
        this.code = code;
        this.error_msg = message;
        this.data = data;
    }

    static success(data) {
        return new GeneralResponse(0, 'OK', data);
    }

    static error(code, message) {
        return new GeneralResponse(code, message, null);
    }
}

module.exports = GeneralResponse;