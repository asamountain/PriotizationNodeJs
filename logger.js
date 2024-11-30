const logger = {
    info: (message, data = '', file = '') => {
        const timestamp = new Date().toISOString();
        const fileInfo = file || new Error().stack.split('\n')[2].match(/\(([^)]+)\)/)[1];
        const logMessage = data ? 
            `${message} ${JSON.stringify(data)}` : 
            message;
        console.log(`${timestamp} [INFO] {file: ${fileInfo}}: ${logMessage}`);
    },

    error: (message, error = '', file = '') => {
        const timestamp = new Date().toISOString();
        const fileInfo = file || new Error().stack.split('\n')[2].match(/\(([^)]+)\)/)[1];
        const errorDetails = error instanceof Error ? 
            error.stack : 
            JSON.stringify(error);
        console.error(`${timestamp} [ERROR] {file: ${fileInfo}}: ${message}`, errorDetails);
    },

    warn: (message, data = '', file = '') => {
        const timestamp = new Date().toISOString();
        const fileInfo = file || new Error().stack.split('\n')[2].match(/\(([^)]+)\)/)[1];
        const warnMessage = data ? 
            `${message} ${JSON.stringify(data)}` : 
            message;
        console.warn(`${timestamp} [WARN] {file: ${fileInfo}}: ${warnMessage}`);
    },

    debug: (message, data = '', file = '') => {
        if (process.env.DEBUG) {
            const timestamp = new Date().toISOString();
            const fileInfo = file || new Error().stack.split('\n')[2].match(/\(([^)]+)\)/)[1];
            const debugMessage = data ? 
                `${message} ${JSON.stringify(data)}` : 
                message;
            console.debug(`${timestamp} [DEBUG] {file: ${fileInfo}}: ${debugMessage}`);
        }
    }
};

export default logger;

