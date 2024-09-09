# Codename `poe2-dat-viewer`

Attempt at porting SnosMe's [poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer) to SvelteKit, in order to improve the tooling around the wiki and prepare tooling for Path of Exile 2.

## WARNING - This is a work in progress

The code in this project is very early in development and is not yet ready for use. It is not yet feature complete and may not work as expected.

## Developing

Once you've installed dependencies with `pnpm install`, start a development server:

```bash
pnpm dev

# or start the server and open the app in a new browser tab
pnpm dev -- --open
```

## Building

To create a production version of your app:

```bash
pnpm build
```

You can preview the production build with `pnpm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
