### API

The iframe uses [Channel Messaging](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API) to communicate with its host. It expects to receive a `s9e:init` message after loading to initiate communication. The iframe sends back a message everytime its content's dimensions change. The message is either a single number (e.g. `300.12`) that represents its height, or two numbers separated with a single space (e.g. `640 360`) that represent its width and height.


### Scheduling

The page starts polling 48 ms after the first message is received. The height is measured at increasingly longer intervals. The delay increases by 12 ms until an interaction is detected (click or resize by the host) at which point it resets back to 48 ms. If the delay reaches 1000 ms, polling stops until an interaction is detected.

The height is polled ~10 times in the first second, ~10 times in the next 2 seconds, ~10 more times in the next 3 seconds. Polling stops if no change is detected in ~40 seconds.


### Geometry

The iframe uses getBoundingClientRect() on the root element to get its dimensions.