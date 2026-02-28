# Remotion: Video Report

## Description
Generate a report about a video that is not working. Downloads the video, sets it as the source in the test component, and renders with verbose logging.

## Trigger
When a user reports a video not working in Remotion.

## Instructions

When a user reports a video not working, we should download the URL and put it as the `src` in `packages/example/src/NewVideo.tsx`.

Then, in `packages/example`, we should run `bunx remotion render NewVideo --log=verbose`.
