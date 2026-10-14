module.exports = {
    apps: [
        {
            name: "my",
            script: "/home/ubuntu/.bun/bin/bun",
            args: "start",
            interpreter: "none",
            instances: "1",
            exec_mode: "cluster",
            watch: true,
            env: {
                PORT: 3002,
                NODE_ENV: "production"
            }
        }
    ]
}
