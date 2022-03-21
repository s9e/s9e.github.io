### API

The iframe uses [Channel Messaging](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API) to communicate with its host. It expects to receive a `s9e:init` message after loading to initiate communication. The iframe sends back a message everytime its content's dimensions change. The message is either a single number (e.g. `300.12`) that represents its height, or two numbers separated with a single space (e.g. `360 640`) that represent its height and width.


### Scheduling

The page starts polling 48 ms after the first message is received. The height is measured at increasingly longer intervals. The delay increases by 12 ms until an interaction is detected (click or resize by the host) at which point it resets back to 48 ms. If the delay reaches 1000 ms, polling stops until an interaction is detected.

The height is polled ~10 times in the first second, ~10 times in the next 2 seconds, ~10 more times in the next 3 seconds. Polling stops if no change is detected in ~40 seconds.


### Timing

Third party scripts are loaded with the `async` attribute and subframes are created in an `onload` event. This allows the page's `onload` event to fire immediately and establish contact with the parent iframe, without having to wait for all of the third party resources to load. This prevents pathologically slow servers from blocking the rest of the execution.


### Geometry

The iframe uses getBoundingClientRect() on the root element to get its dimensions.