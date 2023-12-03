# AudioMIDISyncer

MIDIの発音タイミングをイベントリスナーのように扱うことができます。
自分用に作りましたが、せっかくなので公開しました。

音楽データの再生位置と同期してMIDIイベントを検出できる特徴があります。

MIDIパーサーに「[miz_music](https://github.com/MizunagiKB/miz_music)」「[encoding.js](https://github.com/polygonplanet/encoding.js)」を使用しています。

## 動いてくれるはずのブラウザ

Chrome, Safari, Edge, Firefox

## DEMO

- [オーディオとMIDIのアニメーション同期Demo](https://demo.0db.jp/audio-midi-syncer/water-ripples/)
- [3D Demo2（動作重ため）](https://demo.0db.jp/audio-midi-syncer/3d-lines/)

## 簡単な使い方

``dist/amsync.js``を使った例です。

```html
<script type="module" async>

    import AMSync from 'amsync.js'

    const
        instance = new AMSync.Listener(
            './example.mid', // MIDIファイルを指定します。
            './example.mp3' // 音楽ファイルを指定します。
        )

    instance.addEventListener('ready', () => {// ファイル読み込み完了後に一度だけ発火します。
        instance.play()// 再生されます。
    })

    instance.addEventListener('onlyOnceNoteSounding', event => {// 音がなるタイミングで1度だけ発火します。
        console.log(event)// 引数に情報が入っています。
    })

</script>
```

## メソッド

### イベントリスナー

```js
instance.addEventListener(type, callback);
```

#### type

- ready
- render
- playerPlay
- playerPause
- playerStop
- onlyOnceNoteBeforeSounding
- onlyOnceNoteSounding
- onlyOnceNoteAfterSounding
- noteBeforeSounding
- noteSounding
- noteAfterSounding
- onlyOnceBeforePitchEvent
- onlyOnceAfterPitchEvent
- beforePitchEvent
- afterPitchEvent

### 再生

```js
instance.play()
```

### 一時停止

```js
instance.pause()
```

### 停止

```js
instance.stop()
```

## License
MIT