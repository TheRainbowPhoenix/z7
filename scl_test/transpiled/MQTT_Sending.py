import math

def mqttSendTCP(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   offset: Int
    #   size: Int
    # VAR_TEMP:
    #   i: Int
    if ((context['mqttData'].sendSize + context['size']) <= context['mqttGlobals'].TCP_SENDBUFFERSIZE):
        for _loop_var_2 in range(int(0), int((context['size'] - 1)) + 1):
            context['i'] = _loop_var_2
            context['mqttData'].tcpSendBuf[int(MIN(IN1=(context['i'] + context['mqttData'].sendSize), IN2=context['mqttGlobals'].TCP_SENDBUFFERSIZE))] = context['mqttData'].buffer[int((context['offset'] + context['i']))]
        context['mqttData'].sendSize = (context['mqttData'].sendSize + context['size'])
        context['mqttData'].reqSend = True
    else:
        context['mqttData'].tcp_sendBufferFull = True


def mqttWrite(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   header: Byte
    #   length: Int
    # VAR_TEMP:
    #   lenBuf: Array[0..3] of Byte
    #   llen: Int
    #   digit: Byte
    #   digit_bitview: Array[0..7] of Bool
    #   pos: Int
    #   rc: Int
    #   _len: Int
    #   i: Int
    context['llen'] = 0
    context['pos'] = 0
    context['_len'] = context['length']
    context['digit'] = INT_TO_BYTE((context['_len'] % 128))
    context['_len'] = (context['_len'] / 128)
    if (context['_len'] > 0):
        context['digit_bitview'][int(7)] = 1
    context['lenBuf'][int(context['pos'])] = context['digit']
    context['pos'] = (context['pos'] + 1)
    context['llen'] = (context['llen'] + 1)
    UNTIL((context['_len'] <= 0))
    context['END_REPEAT']
    context['mqttData'].buffer[int((4 - context['llen']))] = context['header']
    for _loop_var_1 in range(int(0), int((context['llen'] - 1)) + 1):
        context['i'] = _loop_var_1
        context['mqttData'].buffer[int(((5 - context['llen']) + context['i']))] = context['lenBuf'][int(context['i'])]
    mqttSendTCP(offset=(4 - context['llen']), size=((context['length'] + 1) + context['llen']))
    context['mqttData'].lastOutActivity = context['mqttData'].runTime


def mqttWriteString(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   str: String
    #   _str: Struct
    #   pos: Int
    # VAR_TEMP:
    #   newPos: Int
    #   i: DInt
    #   j: Int
    context['newPos'] = (context['pos'] + 2)
    context['i'] = 0
    for _loop_var_1 in range(int(1), int(BYTE_TO_INT(context['_str'].act_length)) + 1):
        context['j'] = _loop_var_1
        context['mqttData'].buffer[int(context['newPos'])] = context['_str'].str[int((context['j'] - 1))]
        context['newPos'] = (context['newPos'] + 1)
        context['i'] = (context['i'] + 1)
    context['mqttData'].buffer[int(((context['newPos'] - 2) - context['i']))] = DWORD_TO_BYTE(SHR(IN=DINT_TO_DWORD(context['i']), N=8))
    context['mqttData'].buffer[int(((context['newPos'] - 1) - context['i']))] = DINT_TO_BYTE(context['i'])
    context['mqttWriteString'] = context['newPos']
