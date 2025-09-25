# Database Creation / Migration

```bash
# set this to the path of your database folder
export CODEHARBOR_DB_FOLDER=/home/codeharbor/codeharbor/db

docker container run -it --rm --entrypoint /bin/sh -e HOST_UID=$(id -u) -e HOST_GID=$(id -g) --mount type=bind,src=$CODEHARBOR_DB_FOLDER,dst=/db oven/bun:alpine

# inside container:

apk add git
git clone --depth=1 https://github.com/PurelyAnecdotal/codeharbor.git .

bun install
bun add -D @libsql/client

cd control-panel

export DATABASE_URL=/db/local.db
bun run db:push

chown -R $HOST_UID:$HOST_GID /db
```
