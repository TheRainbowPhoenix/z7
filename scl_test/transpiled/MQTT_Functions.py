import math

def mqttGetNextMessageID(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    context['mqttData'].nextMsgId = (context['mqttData'].nextMsgId + 1)
    if (context['mqttData'].nextMsgId <= 0):
        context['mqttData'].nextMsgId = 1
    context['mqttGetNextMessageID'] = context['mqttData'].nextMsgId


def mqttCONNECT(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   clientID: String
    #   withUsername: Bool
    #   withPassword: Bool
    #   cleanSession: Bool
    #   withWill: Bool
    #   willQos: Int
    #   willRetain: Bool
    #   willTopic: String
    #   willPayload: Any
    #   willPayloadLength: Int
    #   username: String
    #   password: String
    # VAR_TEMP:
    #   l_clientID: String[23]
    #   l_username: String[50]
    #   l_password: String[50]
    #   l_willTopic: String[50]
    #   result: Int
    #   length: Int
    #   fixedHeader: Byte
    #   ptrWillPayload: Any
    #   structWillPtrPayload: UDT_STRUCTANYPTR
    #   ret: Int
    #   i: Int
    #   j: Int
    #   d: Array[0..6] of Byte
    #   llen: Int
    #   _len: Int
    context['l_clientID'] = context['clientID']
    context['l_username'] = context['username']
    context['l_password'] = context['password']
    context['result'] = 0
    context['mqttData'].nextMsgId = 1
    context['length'] = 5
    context['d'][int(0)] = 0
    context['d'][int(1)] = 4
    context['d'][int(2)] = 4
    context['D']
    context['d'][int(3)] = 81
    context['d'][int(4)] = 84
    context['d'][int(5)] = 84
    context['d'][int(6)] = 4
    for _loop_var_1 in range(int(0), int(6) + 1):
        context['j'] = _loop_var_1
        context['mqttData'].buffer[int(context['length'])] = context['d'][int(context['j'])]
        context['length'] = (context['length'] + 1)
    context['mqttData'].buffer[int(context['length'])] = 0
    context['mqttData'].buffer[int(context['length'])] = (((context['mqttData'].buffer[int(context['length'])] or SHL(IN=BOOL_TO_BYTE(context['withUsername']), N=7)) or SHL(IN=BOOL_TO_BYTE(context['withPassword']), N=6)) or SHL(IN=BOOL_TO_BYTE(context['cleanSession']), N=1))
    if (context['withWill'] == True):
        context['mqttData'].buffer[int(context['length'])] = ((context['mqttData'].buffer[int(context['length'])] or SHL(IN=BOOL_TO_BYTE(context['willRetain']), N=5)) or SHL(IN=BOOL_TO_BYTE(context['withWill']), N=2))
        if (context['willQos'] == context['mqttGlobals'].MQTTQOS1):
            context['mqttData'].buffer[int(context['length'])] = (context['mqttData'].buffer[int(context['length'])] or SHL(IN=BOOL_TO_BYTE(True), N=3))
        if (context['willQos'] == context['mqttGlobals'].MQTTQOS2):
            context['mqttData'].buffer[int(context['length'])] = (context['mqttData'].buffer[int(context['length'])] or SHL(IN=BOOL_TO_BYTE(True), N=4))
    context['length'] = (context['length'] + 1)
    context['mqttData'].buffer[int(context['length'])] = DWORD_TO_BYTE(SHR(IN=DINT_TO_DWORD((TIME_TO_DINT(context['mqttGlobals'].MQTT_KEEPALIVE) / 1000)), N=8))
    context['length'] = (context['length'] + 1)
    context['mqttData'].buffer[int(context['length'])] = DINT_TO_BYTE((TIME_TO_DINT(context['mqttGlobals'].MQTT_KEEPALIVE) / 1000))
    context['length'] = (context['length'] + 1)
    context['length'] = mqttWriteString(str=context['l_clientID'], pos=context['length'])
    if (context['withWill'] == True):
        context['l_willTopic'] = context['willTopic']
        context['length'] = mqttWriteString(str=context['l_willTopic'], pos=context['length'])
        context['ptrWillPayload'] = context['willPayload']
        if (context['willPayloadLength'] > 0):
            for _loop_var_3 in range(int(0), int((context['willPayloadLength'] - 1)) + 1):
                context['i'] = _loop_var_3
                context['ret'] = BLKMOV(SRCBLK=context['ptrWillPayload'], DSTBLK=context['mqttData'].buffer[int(context['length'])])
                if (context['ret'] != 0):
                    pass
                context['length'] = (context['length'] + 1)
                context['structWillPtrPayload'].ByteAddressLSB = INT_TO_WORD((WORD_TO_INT(context['structWillPtrPayload'].ByteAddressLSB) + 8))
        else:
            context['mqttData'].buffer[int(context['length'])] = 0
            context['length'] = (context['length'] + 1)
            context['mqttData'].buffer[int(context['length'])] = 0
            context['length'] = (context['length'] + 1)
    if (context['withUsername'] == True):
        context['length'] = mqttWriteString(str=context['l_username'], pos=context['length'])
    if (context['withPassword'] == True):
        context['length'] = mqttWriteString(str=context['l_password'], pos=context['length'])
    context['fixedHeader'] = INT_TO_BYTE(context['mqttGlobals'].MQTTCONNECT)
    mqttWrite(header=context['fixedHeader'], length=(context['length'] - 5))
    context['mqttData'].lastInActivity = context['mqttData'].runTime
    context['mqttData'].lastOutActivity = context['mqttData'].lastInActivity
    context['mqttData']._state = context['mqttGlobals'].MQTT_CONNECTING


def mqttSimpleCONNECT(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   clientID: String
    #   cleanSession: Bool
    # VAR_TEMP:
    #   l_clientID: String[23]
    #   l_cleanSession: Bool
    context['l_clientID'] = context['clientID']
    context['l_cleanSession'] = context['cleanSession']
    mqttCONNECT(clientID=context['l_clientID'], withUsername=False, withPassword=False, cleanSession=context['l_cleanSession'], withWill=False, willQos=0, willRetain=0, willTopic='', willPayload=context['NULL'], willPayloadLength=0, username='', password='')


def mqttDISCONNECT(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    context['mqttData'].buffer[int(0)] = INT_TO_BYTE(context['mqttGlobals'].MQTTDISCONNECT)
    context['mqttData'].buffer[int(1)] = 0
    mqttSendTCP(offset=0, size=2)
    context['mqttData'].lastOutActivity = context['mqttData'].runTime
    context['mqttData']._state = context['mqttGlobals'].MQTT_DISCONNECTED


def mqttSUBSCRIBE(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   topic: String
    #   topicQos: Int
    # VAR_TEMP:
    #   length: Int
    #   l_topic: String[50]
    #   thisMessageID: Int
    if (context['mqttData']._state == context['mqttGlobals'].MQTT_DISCONNECTED):
        return
    context['l_topic'] = context['topic']
    if (128 < (9 + LEN(context['l_topic']))):
        return
    context['length'] = 5
    context['thisMessageID'] = mqttGetNextMessageID()
    context['mqttData'].buffer[int(context['length'])] = DWORD_TO_BYTE(SHR(IN=INT_TO_DWORD(context['thisMessageID']), N=8))
    context['length'] = (context['length'] + 1)
    context['mqttData'].buffer[int(context['length'])] = (INT_TO_BYTE(context['thisMessageID']) and 255)
    context['length'] = (context['length'] + 1)
    context['length'] = mqttWriteString(str=context['l_topic'], pos=context['length'])
    context['mqttData'].buffer[int(context['length'])] = INT_TO_BYTE(context['topicQos'])
    context['length'] = (context['length'] + 1)
    mqttWrite(header=INT_TO_BYTE(context['mqttGlobals'].MQTTSUBSCRIBE), length=(context['length'] - 5))


def mqttUNSUBSCRIBE(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   topic: String
    # VAR_TEMP:
    #   length: Int
    #   l_topic: String[50]
    #   thisMessageID: Int
    #   fixedHeader: Byte
    if (context['mqttData']._state == context['mqttGlobals'].MQTT_DISCONNECTED):
        return
    context['l_topic'] = context['topic']
    if (128 < (9 + LEN(context['l_topic']))):
        return
    context['length'] = 5
    context['thisMessageID'] = mqttGetNextMessageID()
    context['mqttData'].buffer[int(context['length'])] = DWORD_TO_BYTE(SHR(IN=INT_TO_DWORD(context['thisMessageID']), N=8))
    context['length'] = (context['length'] + 1)
    context['mqttData'].buffer[int(context['length'])] = (INT_TO_BYTE(context['thisMessageID']) and 255)
    context['length'] = (context['length'] + 1)
    context['length'] = mqttWriteString(str=context['l_topic'], pos=context['length'])
    context['fixedHeader'] = INT_TO_BYTE(context['mqttGlobals'].MQTTUNSUBSCRIBE)
    context['fixedHeader'] = (context['fixedHeader'] or SHL(IN=BOOL_TO_BYTE(True), N=1))
    mqttWrite(header=context['fixedHeader'], length=(context['length'] - 5))


def mqttPUBLISH(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   topic: String
    #   messageid: Int
    #   payload: Any
    #   payloadLength: Int
    #   qos: Int
    #   retain: Bool
    #   duplicate: Bool
    # VAR_TEMP:
    #   length: Int
    #   i: Int
    #   fixedHeader: Byte
    #   holdstring: String[50]
    #   thisMessageID: Int
    #   tdata: Any
    #   pdata: UDT_STRUCTANYPTR
    #   ret: Int
    #   ptrBuffer: Any
    #   structPtrBuffer: UDT_STRUCTANYPTR
    #   ptrPayload: Any
    #   structPtrPayload: UDT_STRUCTANYPTR
    context['mqttPUBLISH'] = 0
    if (context['mqttData']._state == context['mqttGlobals'].MQTT_DISCONNECTED):
        context['mqttPUBLISH'] = (-1)
        return
    context['fixedHeader'] = INT_TO_BYTE(context['mqttGlobals'].MQTTPUBLISH)
    context['fixedHeader'] = (((context['fixedHeader'] or SHL(IN=BOOL_TO_BYTE(context['duplicate']), N=3)) or SHL(IN=INT_TO_BYTE(context['qos']), N=1)) or BOOL_TO_BYTE(context['retain']))
    context['holdstring'] = context['topic']
    context['length'] = 5
    context['length'] = mqttWriteString(str=context['holdstring'], pos=context['length'])
    if ((context['qos'] == context['mqttGlobals'].MQTTQOS1) or (context['qos'] == context['mqttGlobals'].MQTTQOS2)):
        if (context['messageid'] > 0):
            context['thisMessageID'] = context['messageid']
        else:
            context['thisMessageID'] = mqttGetNextMessageID()
        context['mqttData'].buffer[int(context['length'])] = DWORD_TO_BYTE(SHR(IN=INT_TO_DWORD(context['thisMessageID']), N=8))
        context['length'] = (context['length'] + 1)
        context['mqttData'].buffer[int(context['length'])] = (INT_TO_BYTE(context['thisMessageID']) and 255)
        context['length'] = (context['length'] + 1)
        context['mqttPUBLISH'] = context['thisMessageID']
    context['ptrPayload'] = context['payload']
    if (context['payloadLength'] > 0):
        for _loop_var_2 in range(int(0), int((context['payloadLength'] - 1)) + 1):
            context['i'] = _loop_var_2
            context['ret'] = BLKMOV(SRCBLK=context['ptrPayload'], DSTBLK=context['mqttData'].buffer[int(context['length'])])
            if (context['ret'] != 0):
                pass
            context['length'] = (context['length'] + 1)
            context['structPtrPayload'].ByteAddressLSB = INT_TO_WORD((WORD_TO_INT(context['structPtrPayload'].ByteAddressLSB) + 8))
    mqttWrite(header=context['fixedHeader'], length=(context['length'] - 5))


def mqttPUBACK(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   packetIdMSB: Byte
    #   packetIdLSB: Byte
    context['mqttData'].buffer[int(0)] = INT_TO_BYTE(context['mqttGlobals'].MQTTPUBACK)
    context['mqttData'].buffer[int(1)] = 2
    context['mqttData'].buffer[int(2)] = context['packetIdMSB']
    context['mqttData'].buffer[int(3)] = context['packetIdLSB']
    mqttSendTCP(offset=0, size=4)
    context['mqttData'].lastOutActivity = context['mqttData'].runTime
