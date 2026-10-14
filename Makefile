branch=main
bun=/home/ubuntu/.bun/bin/bun

deploy:
	ssh athens '/snap/bin/lxc exec tci-old --user 1000 --env HOME=/home/ubuntu -- bash -c " \
		source /home/ubuntu/.profile && \
		cd /home/ubuntu/my && \
		git fetch origin ${branch} && \
		git checkout ${branch} && \
		git reset --hard FETCH_HEAD && \
		git pull && \
		${bun} install && \
		/home/ubuntu/.bun/bin/pm2 restart my || /home/ubuntu/.bun/bin/pm2 start ecosystem.config.cjs && \
		/home/ubuntu/.bun/bin/pm2 list"'
