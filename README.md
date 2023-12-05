# AudioMIDISyncer

MIDIの発音タイミングをイベントリスナーのように扱うことができます。
自分用に作りましたが、せっかくなので公開しました。

MIDIパーサーには「[miz_music](https://github.com/MizunagiKB/miz_music)」「[encoding.js](https://github.com/polygonplanet/encoding.js)」を使用しています。

MIDIイベントの検出には``requestAnimationFrame``を使用し、再生開始時刻(timeStamp)からの相対値で算出しているので、描画処理と同期を取りやすい設計になっているかと思います。

ただし、この検出方式はデバイスのスペックに依存するため、以下のイベントタイプではMIDIイベント(短いNoteイベント)を検出できない場合があります。

- onlyOnceNoteSounding
- noteSounding

※ 各イベントタイプの説明は下記にある[イベントリスナーの種類](#イベントリスナーの種類type)で確認できます。

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

#### イベントリスナーの種類(type)

##### 基本

- ready - MIDIデータと音楽データの読み込みが完了した時に発火します。
- render - MIDIイベントの検出ループ同等に発火します。(requestAnimationFrameでのループです。)引数にタイムスタンプを渡します。
- playerPlay - 再生開始時に発火します。
- playerPause - 一時停止時に発火します。
- playerStop - 停止時に発火します。

##### Noteイベント検出

以下は各Noteイベントごとに一度だけ発火

- onlyOnceNoteBeforeSounding - 音がまだ鳴っていない状態のNoteイベントを引数に渡し発火します。
- onlyOnceNoteSounding - 音が鳴っている最中のNoteイベントを引数に渡し発火します。
- onlyOnceNoteAfterSounding - 音が鳴り終えた後のNoteイベントを引数に渡し発火します。

以下は該当するNoteイベントがある場合、常時発火します。

- noteBeforeSounding - 音がまだ鳴っていない状態のNoteイベントを引数に渡し発火します。
- noteSounding - 音が鳴っている最中のNoteイベントを引数に渡し発火します。
- noteAfterSounding - 音が鳴り終えた後のNoteイベントを引数に渡し発火します。

##### Pitchイベント検出

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