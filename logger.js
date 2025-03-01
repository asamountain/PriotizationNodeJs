const logger = {
    info: (message, data = null, source = 'app') => {
      console.log(`[INFO] [${source}] ${message}`, data ? data : '');
    },
    error: (message, error = null, source = 'app') => {
      console.error(`[ERROR] [${source}] ${message}`, error ? error : '');
    }
  };
  
  export default logger;