#!/usr/bin/php
<?php

if (php_sapi_name() !== 'cli')
{
	exit;
}

function minify($m)
{
	$params = [
		'compilation_level' => 'SIMPLE_OPTIMIZATIONS',
		'js_code'           => $m[2],
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
				'timeout' => 20,
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

	return $m[1] . $code . $m[3];
}

function minifyDir($dir)
{
	foreach (glob($dir . '/*.html') as $source)
	{
		if (strpos(basename($source), '.min.') !== false)
		{
			continue;
		}

		$target = substr($source, 0, -4) . 'min.html';
		if (@filemtime($target) === filemtime($source))
		{
			continue;
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
				// https://www.w3.org/TR/html/syntax.html#attribute-value-unquoted-state
				return preg_replace("(=\"\"|(=)\"((?:\\\$\\{(?:'[^'\\s]++'|[^'}])*+\\}|[^\$\"'])*+)\")", '$1$2', $m[0]);
			},
			$html
		);

		$html = preg_replace('/>\\n\\s*</', '><', $html);
		try
		{
			$html = preg_replace_callback('#(<script>)(.+?)(</script>)#s', 'minify', $html);
		}
		catch (RuntimeException $e)
		{
			echo "FAILED\n";
			continue;
		}

		file_put_contents($target, $html);
		touch($target, filemtime($source));
	}
}

minifyDir(__DIR__);
minifyDir(__DIR__ . '/2');