# Leaf-Writer

The [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca) has developed an in-browser text markup editor (LEAF-Writer) for use by individual scholars and collaborative scholarly editing projects that require a light-weight online editing environment. LEAF-Writer is an enhancement to the existing CWRC-Writer; a default version of the CWRC-Writer that uses GitHub for storage is available for anyone's use at [https://cwrc-writer.cwrc.ca/](https://cwrc-writer.cwrc.ca/).

## Table of Contents

[Overview](#overview)
<!--[Storage and Entity Lookup](#storage-and-entity-lookup)
[API](#api)
[Managers](#managers)
[Modules](#modules)
[Development](#development) -->
[Lerna](#lerna)

## Overview
LEAF-Writer is a WYSIWYG text editor for in-browser XML editing and stand-off RDF annotation.  
It is built around a heavily customized version of the [TinyMCE](https://www.tiny.cloud/) editor, and includes a CWRC-hosted XML validation service.

A LEAF-Writer installation is a bundling of the main LEAF-WriterBase (the code in this repository) with a few other NPM packages that handle interaction with server-side services for document storage and named entity lookup.

## Lerna

The Leaf writer project follows a strategy called _monorepo_ where multiple projects or packages are contained in the same source repository. Build order and dependencies are managed with _Lerna_ and an introduction is written up [here](https://www.linkedin.com/pulse/things-i-have-learned-while-maintaining-javascript-monorepo-gorej/).

## Running Leaf-Writer

Docker and Docker Compose is required. Easiest is to install [Docker Desktop](https://www.docker.com/products/docker-desktop).

Clone this repo and run with Docker Compose:

```bash
git clone https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer
cd leaf-writer
docker compose up
```
