# Leaf-Writer

================

![Picture](https://cwrc.ca/logos/CWRC_logos_2016_versions/CWRCLogo-Horz-FullColour.png)

[![Travis](https://img.shields.io/travis/cwrc/CWRC-WriterBase.svg)](https://travis-ci.org/cwrc/CWRC-WriterBase)
[![Codecov](https://img.shields.io/codecov/c/github/cwrc/CWRC-WriterBase.svg)](https://codecov.io/gh/cwrc/CWRC-WriterBase)
[![version](https://img.shields.io/npm/v/cwrc-writer-base.svg)](http://npm.im/cwrc-writer-base)
[![downloads](https://img.shields.io/npm/dm/cwrc-writer-base.svg)](http://npm-stat.com/charts.html?package=cwrc-writer-base&from=2015-08-01)
[![GPL-2.0](https://img.shields.io/npm/l/cwrc-writer-base.svg)](http://opensource.org/licenses/GPL-2.0)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

The [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca) has developed an in-browser text markup editor LEAF-Writer (a modular component of the Linked Editorial Academic Framework) for use by individual scholars and collaborative scholarly editing projects that require a light-weight online editing environment. LEAF-Writer is an enhancement to the existing CWRC-Writer; a default version of the CWRC-Writer that uses GitHub for storage is available for anyone's use at [https://cwrc-writer.cwrc.ca/](https://cwrc-writer.cwrc.ca/).

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
