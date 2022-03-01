# Leaf writer

ToDo: Introduce Leaf writer.

## Lerna

The Leaf writer project follows a strategy called _monorepo_ where multiple projects or packages are contained in the same source repository. Build order and dependencies are managed with _Lerna_ and an introduction is written up [here](https://www.linkedin.com/pulse/things-i-have-learned-while-maintaining-javascript-monorepo-gorej/).

## Running Leaf writer

Docker and Docker Compose is required. Easiest is to install [Docker Desktop](https://www.docker.com/products/docker-desktop).

Clone this repo and run with Docker Compose:

```bash
git clone https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer
cd leaf-writer
docker compose up
```
