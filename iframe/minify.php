#!/usr/bin/php
<?php

if (php_sapi_name() !== 'cli')
{
	exit;
}

function minify($code)
{
	return $code;

	$params = [
		'compilation_level' => 'SIMPLE_OPTIMIZATIONS',
		'js_code'           => $code,
		'output_format'     => 'json',
		'output_info'       => 'compiled_code',
		'language_out'      => 'ECMASCRIPT_2015'
	];

	$content  = http_build_query($params) . '&output_info=errors';
	$response = json_decode(file_get_contents(
		'https://closure-compiler.appspot.com/compile',
		false,
		stream_context_create([
			'http' => [
				'method'  => 'POST',
				'header'  => "Connection: close\r\n"
				           . "Content-length: " . strlen($content) . "\r\n"
				           . "Content-type: application/x-www-form-urlencoded",
				'timeout' => 30,
				'content' => $content
			]
		])
	));
	if (!isset($response->compiledCode))
	{
		throw new RuntimeException;
	}

	$code = str_replace("\n", '', trim($response->compiledCode, ';'));
	$code = preg_replace("(^'use strict';)", '', $code);

	return $code;
}

function minifyDir($dir)
{
	foreach (glob($dir . '/*.html') as $source)
	{
		if (strpos(basename($source), '.min.') !== false)
		{
			continue;
		}

		minifyFile($source, true);
	}
}

function minifyFile(string $source, $checkTime): void
{
	$target = substr($source, 0, -4) . 'min.html';
	if ($checkTime && @filemtime($target) === filemtime($source))
	{
		return;
	}

	$html = file_get_contents($source);
	echo $source, "\n";

	// Remove comments
	$html = preg_replace('(<!--.*?-->)s', '', $html);

	// Remove quotes around attribute values
	$html = preg_replace_callback(
		'(<[^>]+)',
		function ($m)
		{
			return unquoteAttributes($m[0]);
		},
		$html
	);

	$html = preg_replace('(>\\n\\s*<)', '><', $html);
	try
	{
		$html = preg_replace_callback(
			'#(<script>)(.+?)(</script>)#s',
			function ($m)
			{
				return $m[1] . minify($m[2]) . $m[3];
			},
			$html
		);
	}
	catch (RuntimeException $e)
	{
		echo "FAILED\n";

		return;
	}

	file_put_contents($target, $html);
	touch($target, filemtime($source));
}

function unquoteAttributes(string $html): string
{
	return preg_replace_callback(
		'(="([^"]*+)")',
		function ($m)
		{
			if ($m[1] === '')
			{
				// Empty attribute syntax
				return '';
			}

			return (mustBeQuoted($m[1])) ? $m[0] : '=' . $m[1];
		},
		$html
	);
}

function isValidUnquoted(string $attrValue): bool
{
	// https://html.spec.whatwg.org/multipage/syntax.html#unquoted
	return (bool) !preg_match('([\\s"\'=<>`])', $attrValue);

}
function mustBeQuoted(string $attrValue): bool
{
	if (isValidUnquoted($attrValue))
	{
		return false;
	}

	preg_match_all('((?|\\$\\{[^\\}]++\\}|\'\\s*\\+(.*?)\\+\'|[^$]++))', $attrValue, $matches);
	foreach ($matches[0] as $i => $match)
	{
		if (isset($matches[1][$i]))
		{
			preg_match_all("('([^']*+)')", $matches[1][$i], $m);
			foreach ($m[1] as $str)
			{
				if (!isValidUnquoted($str))
				{
					return true;
				}
			}
		}
		elseif (!isValidUnquoted($match))
		{
			return true;
		}
	}

	return false;
}

$paths = array_slice($_SERVER['argv'], 1) ?: [__DIR__, __DIR__ . '/2'];
foreach ($paths as $path)
{
	if (is_dir($path))
	{
		minifyDir($path);
	}
	else
	{
		minifyFile($path, false);
	}
}