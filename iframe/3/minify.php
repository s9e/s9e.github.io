#!/usr/bin/php
<?php declare(strict_types=1);

if (php_sapi_name() !== 'cli')
{
	exit;
}

function minify(string $js)
{
	$exec = __DIR__ . '/node_modules/google-closure-compiler-linux/compiler';
	if (!file_exists($exec))
	{
		echo "Cannot fine $exec\n";

		die(1);
	}

	$temp = __DIR__ . '/temp.js';
	$out  = __DIR__ . '/temp.min.js';

	file_put_contents($temp, $js);

	passthru("$exec --formatting SINGLE_QUOTES -O ADVANCED -W VERBOSE --externs externs.js --jscomp_error '*' --js $temp --js_output_file $out");
	if (!file_exists($out))
	{
		die("Error processing $out\n");
	}

	$js = trim(str_replace("\n", '', file_get_contents($out)), ';');
	$js = preg_replace('(\\blet [^;]++\\K;var )', ',', $js);

	unlink($temp);
	unlink($out);

	return $js;
}

function minifyDir($dir)
{
	foreach (glob($dir . '/*.html') as $source)
	{
		if (str_ends_with($source, '.min.html'))
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
				return preg_replace('(=""|(=)"((?:\' \\+ (?:[^\']|\'[^\'\s]*+\')+? \\+ \'|[^\\s<=>"\'`])*)")', '$1$2', $m[0]);
			},
			$html
		);

		$html = preg_replace('/>\\n\\s*</', '><', $html);
		try
		{
			$html = preg_replace_callback(
				'#<script>\\K(.+?)(?=</script>)#s',
				fn($m) => minify($m[0]),
				$html
			);
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