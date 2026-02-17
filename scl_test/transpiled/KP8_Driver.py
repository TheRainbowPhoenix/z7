import math

def KP8_Driver__Group(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   btnNumber: Int
    #   btnsParams: KP8 Driver: Parameters: 8 Buttons
    # VAR_IN_OUT:
    #   logical: KP8 Driver: Feedback Data
    # VAR_TEMP:
    #   pBtn: Int
    #   retLogical: KP8 Driver: Feedback Data
    #   testGroup: Int
    #   thisGroup: Int
    context['thisGroup'] = context['btnsParams'].btn[int(context['btnNumber'])].group
    if (context['thisGroup'] == 0):
        return
    context['retLogical'] = context['logical']
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBtn'] = _loop_var_1
        if (context['pBtn'] == context['btnNumber']):
            pass # GOTO NEXT (Not supported)
        context['testGroup'] = context['btnsParams'].btn[int(context['pBtn'])].group
        if (context['testGroup'] == context['thisGroup']):
            context['retLogical'].acutal.btn[int(context['pBtn'])] = False
        pass # LABEL NEXT
    context['logical'] = context['retLogical']


def KP8_Driver__Toggle(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   signal: Bool
    # VAR_IN_OUT:
    #   state: Bool
    if context['signal']:
        context['state'] = (not context['state'])


def Upper(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   string: Variant
    # VAR_TEMP:
    #   type: Bool
    #   stringBox: String
    #   status: Int
    #   wStringBox: WString
    #   charArr: Array[0..255] of Char
    #   cntChar: UInt
    #   pChar: Int
    # VAR CONSTANT:
    #   asciiLow: Char
    context['asciiLow'] = 'a'
    #   asciiHigh: Char
    context['asciiHigh'] = 'z'
    #   asciiCaseOffset: Int
    context['asciiCaseOffset'] = 32
    if (TypeOf(context['string']) == context['String']):
        context['status'] = MOVE_BLK_VARIANT(SRC=context['string'], COUNT=1, SRC_INDEX=0, DEST_INDEX=0, DEST=context['stringBox'])
    else:
        if (TypeOf(context['string']) == context['WString']):
            context['status'] = MOVE_BLK_VARIANT(SRC=context['string'], COUNT=1, SRC_INDEX=0, DEST_INDEX=0, DEST=context['wStringBox'])
            context['stringBox'] = WSTRING_TO_STRING(context['wStringBox'])
        else:
            return
    Strg_TO_Chars(Strg=context['stringBox'], pChars=0, Cnt=context['cntChar'], Chars=context['charArr'])
    for _loop_var_1 in range(int(0), int((UINT_TO_INT(context['cntChar']) - 1)) + 1):
        context['pChar'] = _loop_var_1
        if ((context['asciiLow'] <= context['charArr'][int(context['pChar'])]) and (context['charArr'][int(context['pChar'])] <= context['asciiHigh'])):
            context['charArr'][int(context['pChar'])] = INT_TO_CHAR((CHAR_TO_INT(context['charArr'][int(context['pChar'])]) - context['asciiCaseOffset']))
    Chars_TO_Strg(Chars=context['charArr'], pChars=0, Cnt=context['cntChar'], Strg=context['stringBox'])
    if (TypeOf(context['string']) == context['String']):
        context['status'] = MOVE_BLK_VARIANT(SRC=context['stringBox'], COUNT=1, SRC_INDEX=0, DEST_INDEX=0, DEST=context['string'])
    else:
        if (TypeOf(context['string']) == context['WString']):
            context['wStringBox'] = STRING_TO_WSTRING(context['stringBox'])
            context['status'] = MOVE_BLK_VARIANT(SRC=context['wStringBox'], COUNT=1, SRC_INDEX=0, DEST_INDEX=0, DEST=context['string'])


def KP8_Driver__Feedback(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   signal: Bool
    #   oldSignal: Bool
    #   btnNumber: Int
    # VAR_IN_OUT:
    #   feedback: KP8 Driver: Feedback Data
    # VAR_TEMP:
    #   ret: KP8 Driver: Feedback Data
    context['ret'] = context['feedback']
    context['ret'].acutal.btn[int(context['btnNumber'])] = context['signal']
    context['ret'].rising.btn[int(context['btnNumber'])] = False
    context['ret'].falling.btn[int(context['btnNumber'])] = False
    if (context['signal'] != context['oldSignal']):
        if (context['signal'] and (not context['oldSignal'])):
            context['ret'].rising.btn[int(context['btnNumber'])] = True
        if ((not context['signal']) and context['oldSignal']):
            context['ret'].falling.btn[int(context['btnNumber'])] = True
    context['feedback'] = context['ret']


def KP8_Driver__State(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   press: KP8 Driver: Feedback Data
    #   btnNumber: Int
    #   btnParams: KP8 Driver: Parameters: 8 Buttons
    # VAR_IN_OUT:
    #   state: KP8 Driver: Feedback Data
    # VAR_TEMP:
    #   pBtn: Int
    #   retState: KP8 Driver: Feedback Data
    if (not context['btnParams'].btn[int(context['btnNumber'])].activate):
        return
    context['retState'] = context['state']
    if (not context['btnParams'].btn[int(context['btnNumber'])].mode):
        context['retState'].acutal.btn[int(context['btnNumber'])] = context['press'].acutal.btn[int(context['btnNumber'])]
    if context['btnParams'].btn[int(context['btnNumber'])].mode:
        KP8_Driver__Toggle(signal=context['press'].rising.btn[int(context['btnNumber'])], state=context['retState'].acutal.btn[int(context['btnNumber'])])
    if context['press'].rising.btn[int(context['btnNumber'])]:
        KP8_Driver__Group(btnNumber=context['btnNumber'], btnsParams=context['btnParams'], logical=context['retState'])
    context['state'] = context['retState']


def KP8_Driver__Color(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   btnNum: Int
    #   lblColor: String
    # VAR_IN_OUT:
    #   btnColor: DWord
    # VAR_TEMP:
    #   btnMask: DWord
    #   uColor: String
    #   ret: DWord
    # VAR CONSTANT:
    #   btnMskRed: DWord
    context['btnMskRed'] = 16777216
    #   btnMskGreen: DWord
    context['btnMskGreen'] = 65536
    #   btnMskBlue: DWord
    context['btnMskBlue'] = 256
    #   btnMskYellow: DWord
    context['btnMskYellow'] = 16842752
    #   btnMskWhite: DWord
    context['btnMskWhite'] = 16843008
    #   btnMskOff: DWord
    context['btnMskOff'] = 4278124287
    context['ret'] = context['btnColor']
    context['ret'] = (context['ret'] and ROL(IN=context['btnMskOff'], N=INT_TO_UDINT(context['btnNum'])))
    context['uColor'] = context['lblColor']
    Upper(context['uColor'])
    if (context['uColor'] == 'RED'):
        context['btnMask'] = context['btnMskRed']
    else:
        if (context['uColor'] == 'GREEN'):
            context['btnMask'] = context['btnMskGreen']
        else:
            if (context['uColor'] == 'BLUE'):
                context['btnMask'] = context['btnMskBlue']
            else:
                if (context['uColor'] == 'YELLOW'):
                    context['btnMask'] = context['btnMskYellow']
                else:
                    if (context['uColor'] == 'WHITE'):
                        context['btnMask'] = context['btnMskWhite']
                    else:
                        if (context['uColor'] == 'OFF'):
                            pass
    context['ret'] = (context['ret'] or SHL(IN=context['btnMask'], N=INT_TO_UDINT(context['btnNum'])))
    context['btnColor'] = context['ret']


def KP8_Driver(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   kp8DI: Word
    #   reset: Bool
    #   btnParams: KP8 Driver: Parameters: 8 Buttons
    # VAR_OUTPUT:
    #   kp8DQ: DWord
    #   physical: KP8 Driver: Feedback Data
    #   logical: KP8 Driver: Feedback Data
    # VAR DB_SPECIFIC:
    #   colorMask: DWord
    #   old: Struct
    # VAR:
    #   btnPress: KP8 Driver: Button States
    # VAR DB_SPECIFIC:
    #   retLogical: KP8 Driver: Feedback Data
    # VAR_TEMP:
    #   color: String
    #   draw: Bool
    #   pBtn: Int
    #   retPhysical: KP8 Driver: Feedback Data
    #   rst: Struct
    # VAR CONSTANT:
    #   off: DWord
    context['off'] = 0
    if context['reset']:
        context['colorMask'] = context['off']
        context['old'].kp8DI = 0
        context['old'].logical = context['rst'].state
        context['old'].physical = context['rst'].state
        context['retPhysical'] = context['rst'].feedback
        context['retLogical'] = context['rst'].feedback
        return
    if (context['btnParams'] == context['old'].btnParam):
        pass # GOTO NOUPDATE (Not supported)
    context['colorMask'] = context['off']
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBtn'] = _loop_var_1
        if context['btnParams'].btn[int(context['pBtn'])].activate:
            if (not context['retLogical'].acutal.btn[int(context['pBtn'])]):
                context['color'] = context['btnParams'].btn[int(context['pBtn'])]['color off']
        if context['btnParams'].btn[int(context['pBtn'])].activate:
            if context['retLogical'].acutal.btn[int(context['pBtn'])]:
                context['color'] = context['btnParams'].btn[int(context['pBtn'])]['color on 1']
        if (not context['btnParams'].btn[int(context['pBtn'])].activate):
            context['color'] = 'OFF'
        KP8_Driver__Color(btnColor=context['colorMask'], btnNum=context['pBtn'], lblColor=context['color'])
    pass # LABEL NOUPDATE
    SCATTER(IN=context['kp8DI']['%B1'], OUT=context['btnPress'].btn)
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBtn'] = _loop_var_1
        KP8_Driver__Feedback(signal=context['btnPress'].btn[int(context['pBtn'])], oldSignal=context['old'].physical.btn[int(context['pBtn'])], btnNumber=context['pBtn'], feedback=context['retPhysical'])
        KP8_Driver__State(press=context['retPhysical'], btnNumber=context['pBtn'], btnParams=context['btnParams'], state=context['retLogical'])
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBtn'] = _loop_var_1
        KP8_Driver__Feedback(signal=context['retLogical'].acutal.btn[int(context['pBtn'])], oldSignal=context['old'].logical.btn[int(context['pBtn'])], btnNumber=context['pBtn'], feedback=context['retLogical'])
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBtn'] = _loop_var_1
        if context['retLogical'].rising.btn[int(context['pBtn'])]:
            context['color'] = context['btnParams'].btn[int(context['pBtn'])]['color on 1']
            context['draw'] = True
        if context['retLogical'].falling.btn[int(context['pBtn'])]:
            context['color'] = context['btnParams'].btn[int(context['pBtn'])]['color off']
            context['draw'] = True
        if context['retLogical'].acutal.btn[int(context['pBtn'])]:
            if (not context['btnParams'].btn[int(context['pBtn'])].flash):
                if context['old'].btnParam.btn[int(context['pBtn'])].flash:
                    context['color'] = context['btnParams'].btn[int(context['pBtn'])]['color on 1']
                    context['draw'] = True
            if context['btnParams'].btn[int(context['pBtn'])].flash:
                if (not context['old'].btnParam.btn[int(context['pBtn'])].flash):
                    context['color'] = context['btnParams'].btn[int(context['pBtn'])]['color on 2']
                    context['draw'] = True
        if context['draw']:
            context['draw'] = False
            KP8_Driver__Color(btnColor=context['colorMask'], btnNum=context['pBtn'], lblColor=context['color'])
    context['old'].btnParam = context['btnParams']
    context['old'].kp8DI = context['kp8DI']
    context['old'].logical = context['retLogical'].acutal
    context['old'].physical = context['btnPress']
    context['kp8DQ'] = context['colorMask']
    context['physical'] = context['retPhysical']
    context['logical'] = context['retLogical']
