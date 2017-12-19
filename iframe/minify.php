#!/usr/bin/php
<?php

if (php_sapi_name() !== 'cli')
{
	exit;
}

function minify($m)
{
	$params = [
		'compilation_level' => 'ADVANCED_OPTIMIZATIONS',
		'js_code'           => $m[2],
		'output_format'     => 'json',
		'output_info'       => 'compiled_code'
	];

	$content = http_build_query($params) . '&output_info=errors';

	$response = file_get_contents(
		'https://closure-compiler.appspot.com/compile',
		false,
		stream_context_create([
			'http' => [
				'method'  => 'POST',
				'header'  => "Connection: close\r\n"
				           . "Content-length: " . strlen($content) . "\r\n"
				           . "Content-type: application/x-www-form-urlencoded",
				'content' => $content
			]
		])
	);

	return $m[1] . trim(json_decode($response)->compiledCode, ';') . $m[3];
}

foreach (glob(__DIR__ . '/*.html') as $source)
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

	// Remove quotes around attribute values
	$html = preg_replace_callback(
		'(<[^>]+)',
		function ($m)
		{
			return preg_replace('(=""|(=)"([^\\s<=>"]*)")', '$1$2', $m[0]);
		},
		$html
	);

	$html = preg_replace('/>\\n\\s*</', '><', $html);
	$html = preg_replace_callback('#(<script>)(.+?)(</script>)#s', 'minify', $html);

	file_put_contents($target, $html);
	touch($target, filemtime($source));
}