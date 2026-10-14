branch=main
bun=/home/ubuntu/.bun/bin/bun

deploy:
	ssh tci 'source ~/.profile && \
		cd ~/my && \
		git fetch origin ${branch} && \
		git checkout ${branch} && \
		git reset --hard FETCH_HEAD && \
		git pull && \
		${bun} install && \
		${bun} run node_modules/.bin/pm2 restart my || ${bun} run node_modules/.bin/pm2 start ecosystem.config.cjs && \
		${bun} run node_modules/.bin/pm2 list'
