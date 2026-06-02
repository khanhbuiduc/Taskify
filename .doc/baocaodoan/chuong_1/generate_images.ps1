$dir = "C:\Users\HP PC\source\repos\Taskify\.doc\baocaodoan\chuong_1"
$imgDir = Join-Path $dir "img"
if (-not (Test-Path $imgDir)) {
    New-Item -ItemType Directory -Force -Path $imgDir | Out-Null
}

$files = Get-ChildItem -Path $dir -Filter "*.md"
foreach ($file in $files) {
    Write-Host "Processing $($file.Name)..."
    $content = [System.IO.File]::ReadAllText($file.FullName)
    if ($content -match '(?s)```mermaid\r?\n(.*?)\r?\n```') {
        $mermaidContent = $matches[1]
        $mmdPath = Join-Path $dir "$($file.BaseName).mmd"
        # Use UTF-8 encoding so accents in diagrams render correctly
        [System.IO.File]::WriteAllText($mmdPath, $mermaidContent, [System.Text.Encoding]::UTF8)
        
        $imgPath = Join-Path $imgDir "$($file.BaseName).png"
        
        # Run mmdc
        cmd /c npx --yes -p @mermaid-js/mermaid-cli mmdc -i `"$mmdPath`" -o `"$imgPath`" -t default -b white -s 2
        
        Remove-Item $mmdPath -ErrorAction SilentlyContinue
        Write-Host "Generated $imgPath"
    } else {
        Write-Host "No mermaid block found in $($file.Name)"
    }
}
Write-Host "Done!"
