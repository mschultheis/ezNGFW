# ezNGFW

ezNGFW is a Rust-based next-generation firewall project with an eBPF/XDP-oriented data plane, async control plane, REST API, CLI, and SvelteKit admin interface.

## Live Demo

Try the browser-only admin GUI demo on GitHub Pages:

**https://mschultheis.github.io/ezNGFW/?demo=1**

Demo credentials:

- Username: `demo`
- Password: `demo`

The demo uses simulated local browser data only. It does not connect to a real firewall.

## Project Scope

- Rust control plane for firewall orchestration
- eBPF/XDP-focused packet processing architecture
- Zone-based firewall policy model
- NAT, IDS/IPS, VPN, DNS, DHCP, routing, and system management modules
- SvelteKit admin UI with demo mode for public showcase
- GitHub Pages workflow for the static admin demo

## This Repository

This public repository contains only the files needed to build and publish the static admin GUI demo:

- `web/admin/` — SvelteKit demo app
- `.github/workflows/demo-pages.yml` — GitHub Pages deployment
- `README.md` — project and demo information

## Status

This repository is under active development. The public demo is a safe UI showcase, not a hosted firewall backend.
