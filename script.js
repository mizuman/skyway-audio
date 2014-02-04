/**
 * Created by yusuke on 2013/12/20.
 */

//APIキー
// var APIKEY = '6165842a-5c0d-11e3-b514-75d3313b9d05';
var APIKEY = '84db5394-8d3b-11e3-ab66-e500405b4002';

//ユーザーリスト
var userList = [];

//Callオブジェクト
var existingCall;

// Compatibility
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

// Audio contextを生成
var audioContext = new AudioContext();
var gainNode = audioContext.createGainNode();
var pannerNode = audioContext.createPanner();
var analyserNode = audioContext.createAnalyser();
var analyserNodeEffected = audioContext.createAnalyser();
var peakingNode = audioContext.createBiquadFilter();

var frequencyElement;
var frequencyContext;
var frequencyData;
var frequencyDataEffected;

// var frequencyContext = frequencyElement.getContext("2d");

// PeerJSオブジェクトを生成
var peer = new Peer({ key: APIKEY, debug: 3});

// PeerIDを生成
peer.on('open', function(){
    $('#my-id').text(peer.id);
});

// 相手からのコールを受信したら自身のメディアストリームをセットして返答
peer.on('call', function(call){
    call.answer(window.localStream);
    step3(call);
});

// エラーハンドラー
peer.on('error', function(err){
    alert(err.message);
    step2();
});

// イベントハンドラー
$(function(){

    // 相手に接続
    $('#make-call').click(function(){
        var call = peer.call($('#contactlist').val(), window.localStream);
        step3(call);

    });

    // 切断
    $('#end-call').click(function(){
        existingCall.close();
        step2();
    });

    // メディアストリームを再取得
    $('#step1-retry').click(function(){
        $('#step1-error').hide();
        step1();
    });

    // ステップ１実行
    step1();

    //ユーザリス取得開始
    setInterval(getUserList, 2000);

});

function step1 () {
    // メディアストリームを取得する
    navigator.getUserMedia({audio: true, video: true}, function(stream){
        $('#my-video').prop('src', URL.createObjectURL(stream));
        window.localStream = stream;

        // 自分の音声のボリュームをコントロールする
        var mediaStreamSource = audioContext.createMediaStreamSource(stream);
        gainNode.gain.value = document.getElementById("my-gain").value;
        mediaStreamSource.connect(pannerNode);
        pannerNode.connect(gainNode);
        gainNode.connect(peakingNode);
        peakingNode.connect(audioContext.destination);

        // analyser frequency
        frequencyElement = document.getElementById("frequency");
        frequencyContext = frequencyElement.getContext("2d");

        frequencyElement.width = 1023;
        frequencyElement.height = 256;

        frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
        frequencyDataEffected = new Uint8Array(analyserNodeEffected.frequencyBinCount);

        mediaStreamSource.connect(analyserNode);

        peakingNode.type = 5;
        peakingNode.gain.value = -40;
        // peakingNode.Q = 0.1;
        peakingNode.frequency.value = 1000;


        mediaStreamSource.connect(peakingNode);
        peakingNode.connect(analyserNodeEffected);


        showAnalyser();

        step2();
    }, function(){ $('#step1-error').show(); });
}

function step2 () {
    //UIコントロール
    $('#step1, #step3').hide();
    $('#step2').show();
}

function step3 (call) {
    // すでに接続中の場合はクローズする
    if (existingCall) {
        existingCall.close();
    }

    // 相手からのメディアストリームを待ち受ける
    call.on('stream', function(stream){
        $('#their-video').prop('src', URL.createObjectURL(stream));

        // 相手の音声のボリュームをコントロールする
        // var mediaStreamSource = audioContext.createMediaStreamSource(stream);
        // gainNode.gain.value = document.getElementById("gain").value;
        // mediaStreamSource.connect(gainNode);
        // gainNode.connect(audioContext.destination);
        // mediaStreamSource.connect(audioContext.destination);
    });

    // 相手がクローズした場合
    call.on('close', step2);

    // Callオブジェクトを保存
    existingCall = call;

    // UIコントロール
    $('#their-id').text(call.peer);
    $('#step1, #step2').hide();
    $('#step3').show();

}

function getUserList () {
    //ユーザリストを取得
    $.get('https://skyway.io/active/list/'+APIKEY,
        function(list){
            for(var cnt = 0;cnt < list.length;cnt++){
                if($.inArray(list[cnt],userList)<0 && list[cnt] != peer.id){
                    userList.push(list[cnt]);
                    $('#contactlist').append($('<option>', {"value":list[cnt],"text":list[cnt]}));
                }
            }
        }
    );
}

function showAnalyser () {
    analyserNode.getByteFrequencyData(frequencyData);

    // analyserNode.getByteFrequencyData(frequencyDataEffected);
    analyserNodeEffected.getByteFrequencyData(frequencyDataEffected);


    frequencyContext.clearRect(0,0,1023,256);
    frequencyContext.strokeRect(0,0,1023,256);
    frequencyContext.beginPath();
    frequencyContext.strokeStyle = 'rgb(0,0,255)';
    frequencyContext.moveTo(0, 256 - frequencyData[0]);
    for (var i=1, l=frequencyData.length; i<l; i++){
        frequencyContext.lineTo(i, 256 - frequencyData[i]);
        if(frequencyData[i]>250) console.log(i);
    }
    frequencyContext.stroke();

    frequencyContext.beginPath();
    frequencyContext.strokeStyle = 'rgb(255,0,0)';
    frequencyContext.moveTo(0, 256 - frequencyData[0]);
    for (var i=1, l=frequencyData.length; i<l; i++){
        frequencyContext.lineTo(i, 256 - frequencyDataEffected[i]);
        // frequencyContext.lineTo(i, 256 - frequencyDataEffected[i]);
    }
    frequencyContext.stroke();

    requestAnimationFrame(showAnalyser);
}

function showValue () {
    var gain = document.getElementById("my-gain").value;
    document.getElementById("showRangeArea").innerHTML = gain;
    gainNode.gain.value = gain;
}

function showVector () {
    var vector = document.getElementById("my-panner").value;
    document.getElementById("showVectorArea").innerHTML = vector;
    var pos = circleCoord(vector);
    audioContext.listener.setPosition(pos.x,pos.y,0);
}

function showFreq () {
    var frequency = document.getElementById("howl-freq").value;
    document.getElementById("showFreqArea").innerHTML = frequency;
    peakingNode.frequency.value = frequency;
}

function circleCoord (rad) {
    var coordinates = {x:0,y:0};
    coordinates.x = Math.cos(rad * (Math.PI/180));
    coordinates.y = Math.sin(rad * (Math.PI/180));
    return coordinates;
}

