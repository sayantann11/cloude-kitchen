# Placeholder voiceover with the built-in Windows voice. Speeds a line up if it would overrun its slot.
#   powershell -File promo/vo.ps1
Add-Type -AssemblyName System.Speech
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = Get-Content (Join-Path $root 'vo.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$out = Join-Path $root 'out\vo'
New-Item -ItemType Directory -Force $out | Out-Null
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($l in $cfg.lines) {
  $file = Join-Path $out ($l.id + '.wav')
  foreach ($rate in 1, 2, 3, 4) {
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $s.SelectVoice('Microsoft David Desktop')
    $s.Rate = $rate
    $s.SetOutputToWaveFile($file, $fmt)
    $s.Speak($l.tts)
    $s.Dispose()
    $secs = ((Get-Item $file).Length - 44) / (48000 * 2)
    if ($secs -le $l.max) { break }
  }
  '{0}  rate {1}  {2:N2}s (max {3}s)' -f $l.id, $rate, $secs, $l.max
}
