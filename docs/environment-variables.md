# Required Environment Variables

| Environment Variable         | Source                                                                          | Example                                       |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| AUTH_GITHUB_ID               | GitHub OAuth App Client ID                                                      | Ov23liYQQxSvnldMu6pp                          |
| AUTH_GITHUB_SECRET           | GitHub OAuth App Client Secret                                                  | 9418315e0b374c0bcf908dbe926548c72dd5c770      |
| DOCKER_GROUP_ID              | `stat -c '%g' /var/run/docker.sock`                                             | 999                                           |
| OPENVSCODE_SERVER_MOUNT_PATH | Absolute path of the openvscode-server directory                                | /home/codeharbor/codeharbor/openvscode-server |
| GATEWAY_ROOT_DOMAIN          | The domain you want to host CodeHarbor under                                    | example.com                                   |
| DATABASE_DIR                 | Absolute path of the directory containing the database file                     | /home/codeharbor/codeharbor/db                |
| CLOUDFLARED_TUNNEL_TOKEN     | (If using Cloudflare Tunnel)<br>Token from the `cloudflared tunnel run` command | eyJhIjoiZDA1OGM4NTJkMTYxMjkwZGQxZDc2MWE2N...  |
