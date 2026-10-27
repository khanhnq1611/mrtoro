// mrtoro: set when the relay serves this app at /env/<envID>/.
export const relayEnvironment =
  typeof location === "undefined"
    ? undefined
    : location.pathname.match(/^\/env\/(env_[A-Za-z0-9]{16,64})(?:\/|$)/)?.[1]

// The relay does not tunnel the PTY WebSocket, and a browser shell would
// bypass the permission prompts anyway, so there is no terminal there.
export const terminalAvailable = !relayEnvironment
