$rootDir = "C:\Users\HP PC\source\repos\Taskify\.doc\baocaodoan\chuong_2"
$mermaidDir = Join-Path $rootDir "mermaid"
$imgDir = Join-Path $rootDir "img"

if (-not (Test-Path $imgDir)) {
    New-Item -ItemType Directory -Force -Path $imgDir | Out-Null
}

$files = Get-ChildItem -Path $mermaidDir -Filter "*.mmd" | Sort-Object Name
foreach ($file in $files) {
    $imgPath = Join-Path $imgDir "$($file.BaseName).png"
    Write-Host "Rendering $($file.Name) -> $(Split-Path $imgPath -Leaf)"
    cmd /c npx --yes -p @mermaid-js/mermaid-cli mmdc -i `"$($file.FullName)`" -o `"$imgPath`" -t default -b white -s 2
}

Write-Host "Done!"
