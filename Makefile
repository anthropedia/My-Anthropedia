branch=main
bun=/home/ubuntu/.bun/bin/bun

deploy:
	ssh tci 'source ~/.profile && \
		cd ~/my && \
		git fetch origin ${branch} && \
		git checkout ${branch} && \
		git reset --hard FETCH_HEAD~10 && \
		git pull && \
		${bun} install && \
		pm2 restart server && \
		pm2 list'
