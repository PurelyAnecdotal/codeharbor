# Docker Setup

Docker should be already installed on the server.

```bash
# Pull runtime images
docker image pull cgr.dev/chainguard/git:latest
docker image pull mcr.microsoft.com/devcontainers/base:ubuntu

# Create network
docker network create codeharbor

# Build devcontainer cli image
docker buildx build -t devcontainer-cli ./devcontainer-cli
``` 

Copy [compose.template.yaml](compose.template.yaml) to `compose.yaml` and edit as needed.