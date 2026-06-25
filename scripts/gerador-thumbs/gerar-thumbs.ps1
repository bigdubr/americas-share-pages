# Pasta de saída
$outDir = "thumbs"

if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$videos = @(

"https://media.americasimoveis.com.br/Criativos/Criativo%2006%20-%20A5%2099%20Mil%20v4.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2007%20-%20Daytona%20Beach.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2008%20-%20Pontal%20da%20Areia%20Remake.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2009%20v2%20-%20Ocean%202%20Quartos%20460%20Mil%20BL%201%20UND%20506%20-%20AP0373_MERI.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2010%20-%20Ocean%203%20Quartos%20-%20ALTA.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2011%20-%20La%20Plage%202%20Qts%20850%20Mil.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2012%20-%20Cozumel%20Cobertura.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2013%20-%20Hermes%20de%20Lima%20Nomad%20Locacao%20Alta_2.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2014%20-%20Copacabana%20Cobertura.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2015%20-%20Contemporeneo%203Qts%20570%20mil.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2016%20-%20Casa%20Riviera%20del%20Sol_1.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2017%20-%20A5%20150%20Mil%20Mobiliada_1.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2018%20-%20Ocean%20BL%204%20UND%20509%20650%20Mil%20-%20AP0108_MERI_1.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2019%20-%20Ocean%20BL%202%20UND%20305%20450%20Mil%20-%20AP0333_MERI_1.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2020%20-%20A5%20BL%201%20UND%20235%20-%20SA0216_MERI_1.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2021%20-%20Ocean%20BL%204%20UND%20304%20570%20Mil%20-%20AP0113_MERI_1.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2022%20-%20Luar%20do%20Pontal%20BL%207%20UND%20611%20560%20Mil%20-%20AP0721_MERI%20Alta_1.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2023%20-%20Ary%20Rongel%20740%20APT%20204%20-%20AP0701_MERI-h265.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2024%20-%20Crystal%20Mall%20Loja%20330%20-%20LO0073_MERI%20LOW.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2025%20-%20Jose%20Americo%20UND%20204%20-%20930%20mil%20-AP0144_MERI_h265.mp4",
"https://media.americasimoveis.com.br/Criativos/Criativo%2026%20-%20Le%20Jour%20BL%202%20UND%20108%20-%20620%20mil%20-%20AP0756_MERI_h265.mp4"

)

foreach($url in $videos){

    $uri = [System.Uri]$url

    $nome = [System.IO.Path]::GetFileNameWithoutExtension(
        [System.Uri]::UnescapeDataString($uri.AbsolutePath)
    )

    $saida = Join-Path $outDir "$nome.webp"

    Write-Host "Gerando: $nome"

    ffmpeg `
        -y `
        -ss 1 `
        -i $url `
        -frames:v 1 `
        -vf "scale=360:640" `
        -c:v libwebp `
        -quality 75 `
        $saida

}

Write-Host ""
Write-Host "Finalizado!"