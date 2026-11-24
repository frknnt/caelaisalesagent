import { installNetworkGuard } from "../support/network-guard.mjs";

// No test may reach a network, loopback included. A test that needs an
// external service uses a fake from lib/testing.
installNetworkGuard();
