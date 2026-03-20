Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::new("content\images\diag-test\diag-no-radius.png")
$w = $img.Width

# Scan row 50 (inside the header area - should be white/frame content)
$y = 50
Write-Host "Row ${y} - finding frame right edge (scanning right to left for non-background):"
for ($x = $w - 1; $x -ge 900; $x--) {
    $p = $img.GetPixel($x, $y)
    # Not background (248,250,252)
    if ($p.R -ne 248 -or $p.G -ne 250 -or $p.B -ne 252) {
        Write-Host ("  FIRST non-bg at x={0}: R={1} G={2} B={3}" -f $x, $p.R, $p.G, $p.B)
        # Show a few more
        for ($x2 = $x; $x2 -ge [Math]::Max(900, $x - 10); $x2--) {
            $p2 = $img.GetPixel($x2, $y)
            Write-Host ("    x={0}: R={1} G={2} B={3}" -f $x2, $p2.R, $p2.G, $p2.B)
        }
        break
    }
}

# Also check: where does the LEFT border start on row 50?
Write-Host ""
Write-Host "Row ${y} - left edge detail:"
for ($x = 8; $x -lt 25; $x++) {
    $p = $img.GetPixel($x, $y)
    Write-Host ("  x={0}: R={1} G={2} B={3}" -f $x, $p.R, $p.G, $p.B)
}

# What about scanning the very top of the frame?
# Row 5 should be near the top border
$y = 5
Write-Host ""
Write-Host "Row ${y} - top border, scanning right portion:"
for ($x = $w - 1; $x -ge 900; $x--) {
    $p = $img.GetPixel($x, $y)
    if ($p.R -ne 248 -or $p.G -ne 250 -or $p.B -ne 252) {
        Write-Host ("  FIRST non-bg at x={0}: R={1} G={2} B={3}" -f $x, $p.R, $p.G, $p.B)
        for ($x2 = $x; $x2 -ge [Math]::Max(900, $x - 5); $x2--) {
            $p2 = $img.GetPixel($x2, $y)
            Write-Host ("    x={0}: R={1} G={2} B={3}" -f $x2, $p2.R, $p2.G, $p2.B)
        }
        break
    }
}

$img.Dispose()
