# Security and privacy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub Security Advisories for this repository. Do not open a public issue containing exploit details, secrets, private camera frames, or identifying recordings.

## Camera privacy model

The application requests camera access only after a user action. Frames are passed locally from the browser video element to MediaPipe and are not uploaded by project code. The app stores only device preferences, calibration values, and onboarding completion in local browser storage. Benchmark files are created only when the user starts recording and explicitly exports them.

MediaPipe WASM/model assets are fetched from pinned distribution URLs, so those hosts receive ordinary network request metadata. No camera pixels are sent with those requests.

## Supported versions

Security fixes target the current `main` branch until the first stable release policy is defined.
