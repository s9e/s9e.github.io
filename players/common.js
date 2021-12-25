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

	let nodes   = document.querySelectorAll('span[' + dataPrefix + '-iframe]'),
		i       = 0,
		dummies = [],
		top     = 0,
		bottom  = window.innerHeight,
		timeout = 0,
		hasScrolled     = false,
		lastScrollY     = 0,
		scrollDirection = SCROLL_DOWN,
		activeMiniplayerSpan = null;
	while (i < nodes.length)
	{
		dummies.push(nodes[i++]);
	}

	setTimeout(init, REFRESH_DELAY);
	function init()
	{
		// Initialize the last scroll position at current scroll position
		lastScrollY = window.scrollY;
		prepareEvents(window.addEventListener);
		refresh();
	}

	function prepareEvents(fn)
	{
		fn('click',  scheduleRefresh);
		fn('load',   scheduleRefresh);
		fn('resize', scheduleRefresh);
		fn('scroll', scheduleRefresh, true);
	}

	function isInRange(element)
	{
		let rect = element.getBoundingClientRect();

		// Test for width to ensure the element isn't hidden in a spoiler
		if (rect.bottom < top || rect.top > bottom || !rect.width)
		{
			return false;
		}

		// Elements in a non-expanded quotes are limited to a 270px width. This is not a perfect
		// indicator but it works well enough to cover the overwhelming majority of embeds
		if (rect.width === 270 && isHiddenInQuote(element, rect.top))
		{
			return false;
		}

		return true;
	}

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

	function loadIframe(dummy)
	{
		let iframe = document.createElement('iframe'),
			values = JSON.parse(dummy.getAttribute(dataPrefix + '-iframe')),
			i      = -1;
		while (++i < values.length)
		{
			iframe.setAttribute(values[i], values[++i]);
		}
		iframe['loading'] = 'eager';

		if (iframe.getAttribute(dataPrefix + '-api') == 2)
		{
			iframe.onload = onResizableIframeLoad;
		}
/*
		if (iframe.onload)
		{
			// Mannually trigger the iframe's onload if the iframe was preloaded by the browser.
			// That can happen on Chrome when using back/forward navigation
			iframe.onload();
		}
*/
		let parentNode = dummy.parentNode;
		prepareMiniplayer(iframe, parentNode);
		parentNode.replaceChild(iframe, dummy);
	}

	function onResizableIframeLoad(e)
	{
		let iframe  = e.target,
			channel = new MessageChannel,
			origin  = iframe.src.substr(0, iframe.src.indexOf('/', 8));
		iframe.contentWindow.postMessage('s9e:init', origin, [channel.port2]);
		channel.port1.onmessage = function (e)
		{
			let dimensions = ("" + e.data).split(' ');
			resizeIframe(iframe, dimensions[0], dimensions[1] || 0);
		};
	}

	function getIframePosition(iframe)
	{
		let rect = iframe.getBoundingClientRect();
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

	function getElementRectProperty(selector, prop)
	{
		let el = document.querySelector(selector);

		return (el) ? el.getBoundingClientRect()[prop] : -1;
	}

	function resizeIframe(iframe, height, width)
	{
		let iframePosition = getIframePosition(iframe),
			expandUpward   = (iframePosition === ABOVE || (iframePosition === VISIBLE && scrollDirection === SCROLL_UP)),
			oldDistance    = (expandUpward) ? getDistanceFromBottom() : 0,
			style          = iframe.style;

		// Temporarily disable transitions if the iframe isn't visible or we need to scroll the page
		if (iframePosition !== VISIBLE || expandUpward)
		{
			style.transition = 'none';
			setTimeout(
				function ()
				{
					style.transition = '';
				},
				0
			);
		}

		style.height = height + 'px';
		if (width)
		{
			style.width = width + 'px';
		}

		if (expandUpward)
		{
			let newDistance = getDistanceFromBottom(),
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

	function getDistanceFromBottom()
	{
		// NOTE: scrollY has higher IE requirements than scrollBy()
		return getElementRectProperty('html', 'height') - window.scrollY;
	}

	function refresh()
	{
		if (lastScrollY !== window.scrollY)
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

		let newDummies = [];
		dummies.forEach(
			function (dummy)
			{
				if (isInRange(dummy))
				{
					if (dummy.hasAttribute(dataPrefix + '-c2l'))
					{
						prepareClickToLoad(dummy);
					}
					else
					{
						loadIframe(dummy);
					}
				}
				else
				{
					newDummies.push(dummy);
				}
			}
		);
		dummies = newDummies;

		if (!dummies.length)
		{
			prepareEvents(window.removeEventListener);
		}
	}

	function handleMiniplayerClick(e)
	{
		let span   = e.target,
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

	function handleMiniplayerTransition(e)
	{
		let iframe = e.target,
			span   = iframe.parentNode;

		if (/-tn/.test(span.className))
		{
			span.className = span.className.replace('-tn', '');
			iframe.removeAttribute('style');
		}
	}

	function prepareClickToLoad(dummy)
	{
		if (dummy.hasAttribute(dataPrefix + '-c2l-background'))
		{
			// Set the background on the dummy's wrapper if applicable
			let node = (dummy.hasAttribute(dataPrefix)) ? dummy : dummy.parentNode.parentNode;
			node.style.background = dummy.getAttribute(dataPrefix + '-c2l-background');
		}
		dummy.onclick = function (e)
		{
			// Don't let the click be handled as a miniplayer-related click
			e.stopPropagation();
			loadIframe(dummy);
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
})(window, document, 'data-s9e-mediaembed', 's9e-miniplayer');