module.exports = {
    apps: [
        {
            name: "my",
            script: "server.ts",
            interpreter: "/home/ubuntu/.bun/bin/bun",
            interpreter_args: "run",
            instances: "1",
            exec_mode: "fork",
            watch: true,
            env: {
                PORT: 3002,
                NODE_ENV: "production"
            }
        }
    ]
}
