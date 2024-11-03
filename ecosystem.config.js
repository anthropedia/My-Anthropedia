export {
    apps: [
        {
            name: "my", 
            script: "bun",           // Command to run
            args: "start", // Adjust the path to your entry file
            interpreter: "none",     // Since we are using bun, we don't need a specific interpreter
            instances: "1",        // Use all available CPU cores
            exec_mode: "cluster",    // Enable cluster mode for better performance
            watch: true,             // Enable watching for changes (optional)
            env: {
                PORT: 3002,          // Set environment variables if needed
                NODE_ENV: "production"
            }
        }
    ]
