(function (window, document, dataPrefix, classPrefix)
{
	// Delay in milliseconds between events and checking for visible elements
	const REFRESH_DELAY = 32;

	// Enum indicating an iframe's position in relation to viewport
	const ABOVE   = 0;
	const VISIBLE = 1;
	const BELOW   = 2;

	// Enum indicating the scrolling direction
	const SCROLL_DOWN = 0;
	const SCROLL_UP   = 1;

	// Max number of items in storage
	const STORAGE_MAX_SIZE = 100;

	let nodes   = document.querySelectorAll('span[' + dataPrefix + '-iframe]'),
		i       = 0,
		proxies = [],
		top     = 0,
		bottom  = window.innerHeight,
		timeout = 0,
		hasScrolled     = false,
		lastScrollY     = window.scrollY,
		scrollDirection = SCROLL_DOWN,
		activeMiniplayerSpan = null,
		localStorage         = {};
	while (i < nodes.length)
	{
		proxies.push(nodes[i++]);
	}

	try
	{
		localStorage = window.localStorage;
	}
	catch (e)
	{
	}

	// Start loading embeds immediately. It will let dynamic embeds be resized before the document
	// is fully loaded (and without a transition if readyState !== "complete")
	prepareEvents(window.addEventListener);
	refresh();

	/**
	* @param {!Function} fn
	*/
	function prepareEvents(fn)
	{
		const options = { 'capture': true, 'passive': true };

		fn('click',  scheduleRefresh, options);
		fn('load',   scheduleRefresh, options);
		fn('resize', scheduleRefresh, options);
		fn('scroll', scheduleRefresh, options);
	}

	/**
	* @param {!Element} element
	*/
	function isInRange(element)
	{
		const rect = element.getBoundingClientRect();

		// Test for width to ensure the element isn't hidden in a spoiler
		if (rect.bottom < top || rect.top > bottom || !rect.width)
		{
			return false;
		}

		return !isHiddenInQuote(element, rect.top);
	}

	/**
	* @param  {!Element} element
	* @param  {number}   top
	* @return {boolean}
	*/
	function isHiddenInQuote(element, top)
	{
		let parentNode = element.parentNode,
			block      = parentNode;
		while (parentNode.tagName !== 'BODY')
		{
			if (/bbCodeBlock-expandContent/.test(parentNode.className))
			{
				block = parentNode;
			}
			parentNode = parentNode.parentNode;
		}

		return (top > block.getBoundingClientRect().bottom);
	}

	function scheduleRefresh()
	{
		clearTimeout(timeout);
		timeout = setTimeout(refresh, REFRESH_DELAY);
	}

	/**
	* @param {!HTMLSpanElement} proxy
	*/
	function loadIframe(proxy)
	{
		let iframe = document.createElement('iframe'),
			values = JSON.parse(proxy.getAttribute(dataPrefix + '-iframe')),
			i      = -1;
		while (++i < values.length)
		{
			iframe.setAttribute(values[i], values[++i]);
		}
		iframe['loading'] = 'eager';
/*
		if (iframe.onload)
		{
			// Mannually trigger the iframe's onload if the iframe was preloaded by the browser.
			// That can happen on Chrome when using back/forward navigation
			iframe.onload();
		}
*/
		const parentNode = proxy.parentNode;
		prepareMiniplayer(iframe, parentNode);
		parentNode.replaceChild(iframe, proxy);

		if (iframe.getAttribute(dataPrefix + '-api') == 2)
		{
			iframe.onload = onResizableIframeLoad;

			// Resize the iframe after it's been inserted in the page so it's resized the right way
			// (upward/downward) and with a transition if visible
			const storageKey = getStorageKey(iframe.src);
			if (typeof localStorage[storageKey] === 'string')
			{
				const dimensions = localStorage[storageKey].split(' ');
				resizeIframe(iframe, dimensions[0], dimensions[1] || 0);
			}
		}
	}

	function onResizableIframeLoad(e)
	{
		const iframe  = e.target,
		      channel = new MessageChannel,
		      src     = iframe.src,
		      origin  = src.substr(0, src.indexOf('/', 8));
		iframe.contentWindow.postMessage('s9e:init', origin, [channel.port2]);
		channel.port1.onmessage = function (e)
		{
			const data       = ('' + e.data),
			      dimensions = data.split(' ');

			resizeIframe(iframe, dimensions[0], dimensions[1] || 0);
			storeIframeData(src, data);
		};
	}

	/**
	* @param  {!Element} iframe
	* @return {number}
	*/
	function getIframePosition(iframe)
	{
		const rect = iframe.getBoundingClientRect();
		if (rect.bottom > window.innerHeight)
		{
			return BELOW;
		}

		let top = -1;
		if (!hasScrolled && location.hash)
		{
			// If the page hasn't been scrolled, use the top of the URL's target as the boundary
			top = getElementRectProperty(location.hash, 'top');
		}
		if (top < 0)
		{
			// Otherwise, use the bottom of the sticky header as the boundary
			top = getElementRectProperty('.p-navSticky', 'bottom');
		}

		return (rect.top < top) ? ABOVE : VISIBLE;
	}

	/**
	* @param  {string} selector
	* @param  {string} prop
	* @return {number}
	*/
	function getElementRectProperty(selector, prop)
	{
		const el = document.querySelector(selector);

		return (el) ? el.getBoundingClientRect()[prop] : -1;
	}

	/**
	* @param {!Element}      iframe
	* @param {number|string} height
	* @param {number|string} width
	*/
	function resizeIframe(iframe, height, width)
	{
		const iframePosition = getIframePosition(iframe),
		      expandUpward   = (iframePosition === ABOVE || (iframePosition === VISIBLE && scrollDirection === SCROLL_UP)),
		      oldDistance    = (expandUpward) ? getDistanceFromBottom() : 0,
		      style          = iframe.style;

		// Temporarily disable transitions if the document isn't fully loaded yet, the iframe isn't
		// visible, or we need to scroll the page
		if (iframePosition !== VISIBLE || expandUpward || document.readyState !== 'complete')
		{
			style.transition = 'none';
			setTimeout(
				function ()
				{
					style.transition = '';
				},
				// Setting the delay to 0 seems to have no effect on Firefox
				REFRESH_DELAY
			);
		}

		style.height = height + 'px';
		if (width)
		{
			style.width = width + 'px';
		}

		if (expandUpward)
		{
			const newDistance = getDistanceFromBottom(),
			      scrollDiff  = newDistance - oldDistance;
			if (scrollDiff)
			{
				window.scrollBy(0, scrollDiff);
			}

			// Update lastScrollY regardless of scrollDiff because some browsers (Firefox?) may
			// automatically preserve the scrolling position when an element's height change
			lastScrollY = window.scrollY;
		}
	}

	/**
	* @return {number}
	*/
	function getDistanceFromBottom()
	{
		// NOTE: scrollY has higher IE requirements than scrollBy()
		return getElementRectProperty('html', 'height') - window.scrollY;
	}

	function refresh()
	{
		if (lastScrollY === window.scrollY)
		{
			// Reset the scroll direction on click so that tweets expand downward when expanding a
			// quote after scrolling up
			scrollDirection = SCROLL_DOWN;
		}
		else
		{
			hasScrolled     = true;
			scrollDirection = (lastScrollY > (lastScrollY = window.scrollY)) ? SCROLL_UP : SCROLL_DOWN;
		}

		// Refresh the loading zone and extend it if we're done loading the page
		if (document.readyState === 'complete')
		{
			bottom = window.innerHeight * 2;
			top    = -bottom / ((scrollDirection === SCROLL_DOWN) ? 4 : 2);
		}

		const newProxies = [];
		proxies.forEach(
			function (proxy)
			{
				if (isInRange(proxy))
				{
					if (proxy.hasAttribute(dataPrefix + '-c2l'))
					{
						prepareClickToLoad(proxy);
					}
					else
					{
						loadIframe(proxy);
					}
				}
				else
				{
					newProxies.push(proxy);
				}
			}
		);
		proxies = newProxies;

		if (!proxies.length)
		{
			prepareEvents(window.removeEventListener);
		}
	}

	/**
	* @param {!Event} e
	*/
	function handleMiniplayerClick(e)
	{
		const span   = e.target,
		      iframe = span.firstChild,
		      rect   = span.getBoundingClientRect(),
		      root   = document.documentElement,
		      style  = iframe.style;

		style.bottom = (root.clientHeight - rect.bottom) + 'px';
		style.height = rect.height + 'px';
		style.right  = (root.clientWidth - rect.right) + 'px';
		style.width  = rect.width + 'px';

		// Force a layout calc
		iframe.offsetHeight;

		if (/inactive/.test(span.className))
		{
			span.className = classPrefix + '-active-tn';
			iframe.removeAttribute('style');

			if (activeMiniplayerSpan)
			{
				activeMiniplayerSpan.click();
			}
			activeMiniplayerSpan = span;
		}
		else
		{
			span.className = classPrefix + '-inactive-tn';
			activeMiniplayerSpan = null;
		}
	}

	/**
	* @param {!Event} e
	*/
	function handleMiniplayerTransition(e)
	{
		const iframe = e.target,
		      span   = iframe.parentNode;

		if (/-tn/.test(span.className))
		{
			span.className = span.className.replace('-tn', '');
			iframe.removeAttribute('style');
		}
	}

	/**
	* @param {!HTMLSpanElement} proxy
	*/
	function prepareClickToLoad(proxy)
	{
		const wrapper = proxy.parentNode.parentNode;
		proxy.setAttribute(dataPrefix + '-c2l', wrapper.getAttribute(dataPrefix));
		if (proxy.hasAttribute(dataPrefix + '-c2l-poster'))
		{
			wrapper.style.background = 'url(' + proxy.getAttribute(dataPrefix + '-c2l-poster') + ') center / cover';
		}
		proxy.onclick = function (e)
		{
			// Don't let the click be handled as a miniplayer-related click
			e.stopPropagation();
			loadIframe(proxy);
		};
	}

	function prepareMiniplayer(iframe, span)
	{
		if (iframe.hasAttribute(dataPrefix) || span.hasAttribute('style'))
		{
			return;
		}

		span.className = classPrefix + '-inactive';
		span.onclick   = handleMiniplayerClick;

		// NOTE: Chrome doesn't seem to support iframe.ontransitionend
		iframe.addEventListener('transitionend', handleMiniplayerTransition);
	}

	/**
	* @param  {string} url
	* @return {string}
	*/
	function getStorageKey(url)
	{
		// "https://s9e.github.io/iframe/2/twitter.min.html#1493638827008737282#theme=dark"
		// should become "s9e/2/twitter#1493638827008737282"
		return 's9e/' + url.replace(/.*?iframe\/(\d+\/\w+)[^#]*(#[^#]+)(?:#.*)?/, '$1$2');
	}

	/**
	* @param {string} src
	* @param {string} data
	*/
	function storeIframeData(src, data)
	{
		try
		{
			// Clean up local storage some ~10% of the time
			if (Math.random() < .1)
			{
				pruneLocalStorage();
			}
			localStorage[getStorageKey(src)] = data;
		}
		catch (e)
		{
		}
	}

	function pruneLocalStorage()
	{
		// If the storage exceeds the maximum size, remove roughly half the entries created by
		// this script, selected randomly. We do not need an elaborate eviction strategy, we just
		// need to make some room
		let i = localStorage.length || 0;
		if (i > STORAGE_MAX_SIZE)
		{
			while (--i >= 0)
			{
				const storageKey = localStorage.key(i);
				if (/^s9e\//.test(storageKey) && Math.random() < .5)
				{
					localStorage.removeItem(storageKey);
				}
			}
		}
	}
})(window, document, 'data-s9e-mediaembed', 's9e-miniplayer');