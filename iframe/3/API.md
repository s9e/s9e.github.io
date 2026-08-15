## API

As soon as the iframe is loaded, its parent must send the following message: `s9e:init:3`, along with a port that will be used for bidirectional messaging. The `3` part refers to the API version.




### Reference implementation

***In progress***

```js
let c = new MessageChannel,
	w = this.contentWindow;
c.port1.onmessage = (e) =>
{
	let data   = e.data,
		method = data['method'];

	if (method === 'resize')
	{
		let height = +data['height'],
			width  = +data['width'];
		if (height)
		{
			this.style.height = height + 'px';
		}
		if (width)
		{
			this.style.width = width + 'px';
		}
	}
	else if (method === 'forward')
	{
		window.addEventListener(
			'message',
			(e) =>
			{
				if (e.source.parent === w)
				{
					c.port1.postMessage(
						{
							'method': 'message',
							'data':   data['data']
						}
					);
				}
			}
		);
	}
};
w.postMessage('s9e:init', '*', [c.port2]);
```
