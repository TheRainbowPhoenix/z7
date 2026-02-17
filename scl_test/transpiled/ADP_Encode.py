import math

def ADP_Encode_Size_and_Face(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   size_and_face: String
    #   decoded: ADP: Decoded: Size and Face
    #   encoded: ADP: Encoded: Formatting: Size and Face
    # VAR_TEMP:
    #   _return: String
    if (context['size_and_face'] == context['decoded'].bold_5):
        context['_return'] = context['encoded'].bold_5
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_11):
        context['_return'] = context['encoded'].bold_11
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_14):
        context['_return'] = context['encoded'].bold_14
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_15):
        context['_return'] = context['encoded'].bold_15
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_16):
        context['_return'] = context['encoded'].bold_16
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_22):
        context['_return'] = context['encoded'].bold_22
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_30):
        context['_return'] = context['encoded'].bold_30
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_32):
        context['_return'] = context['encoded'].bold_32
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_40):
        context['_return'] = context['encoded'].bold_40
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_5):
        context['_return'] = context['encoded'].normal_5
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_7):
        context['_return'] = context['encoded'].normal_7
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_9):
        context['_return'] = context['encoded'].normal_9
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_11):
        context['_return'] = context['encoded'].normal_11
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_14):
        context['_return'] = context['encoded'].normal_14
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_15):
        context['_return'] = context['encoded'].normal_15
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_16):
        context['_return'] = context['encoded'].normal_16
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_22):
        context['_return'] = context['encoded'].normal_22
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_24):
        context['_return'] = context['encoded'].normal_24
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_30):
        context['_return'] = context['encoded'].normal_30
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_32):
        context['_return'] = context['encoded'].normal_32
        pass # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_40):
        context['_return'] = context['encoded'].normal_40
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Size and Face'] = context['_return']


def ADP_Encode_Horizontal_Alignment(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   horizontal_alignment: String
    #   decoded: ADP: Decoded: Horizontal Alignment
    #   encoded: ADP: Encoded: Formatting: Horizontal Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['horizontal_alignment'] == context['decoded'].center):
        context['_return'] = context['encoded'].center
        pass # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].left):
        context['_return'] = context['encoded'].left
        pass # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].right):
        context['_return'] = context['encoded'].right
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Horizontal Alignment'] = context['_return']


def ADP_Encode_Scroll_Speed(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   scroll_speed: String
    #   decoded: ADP: Decoded: Scroll Speed
    #   encoded: ADP: Encoded: Formatting: Scroll Speed
    # VAR_TEMP:
    #   _return: String
    if (context['scroll_speed'] == context['decoded'].slowest):
        context['_return'] = context['encoded'].slowest
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].slow):
        context['_return'] = context['encoded'].slow
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].normal):
        context['_return'] = context['encoded'].normal
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fast):
        context['_return'] = context['encoded'].fast
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fastest):
        context['_return'] = context['encoded'].fastest
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Scroll Speed'] = context['_return']


def ADP_Encode_Flashing(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   flash: String
    #   encoded: ADP: Encoded: Formatting: Flashing
    #   decoded: ADP: Decoded: Flash
    # VAR_TEMP:
    #   _return: String
    if (context['flash'] == context['decoded'].off):
        context['_return'] = context['encoded'].off
        pass # GOTO RTRN (Not supported)
    if (context['flash'] == context['decoded'].on):
        context['_return'] = context['encoded'].on
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Flashing'] = context['_return']


def ADP_Encode_Vertical_Alignment(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   vertical_alignment: String
    #   decoded: ADP: Decoded: Vertical Alignment
    #   encoded: ADP: Encoded: Formatting: Vertical Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['vertical_alignment'] == context['decoded'].bottom_hold):
        context['_return'] = context['encoded'].bottom_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_hold):
        context['_return'] = context['encoded'].fill_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_hold):
        context['_return'] = context['encoded'].middle_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_hold):
        context['_return'] = context['encoded'].top_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].bottom_scroll):
        context['_return'] = context['encoded'].bottom_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_scroll):
        context['_return'] = context['encoded'].fill_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_scroll):
        context['_return'] = context['encoded'].middle_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_scroll):
        context['_return'] = context['encoded'].top_scroll
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Vertical Alignment'] = context['_return']


def ADP_Encode_Color(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   color: String
    #   decoded: ADP: Decoded: Color
    #   encoded: ADP: Encoded: Formatting: Color
    # VAR_TEMP:
    #   _return: String
    # VAR CONSTANT:
    #   black: String
    context['black'] = 'BLACK'
    #   blue: String
    context['blue'] = 'BLUE'
    #   green: String
    context['green'] = 'GREEN'
    #   m1: String
    context['m1'] = 'MIX 1'
    #   m2: String
    context['m2'] = 'MIX 2'
    #   m3: String
    context['m3'] = 'MIX 3'
    #   m4: String
    context['m4'] = 'MIX 4'
    #   red: String
    context['red'] = 'RED'
    #   white: String
    context['white'] = 'WHITE'
    #   yellow: String
    context['yellow'] = 'YELLOW'
    if (context['color'] == context['decoded'].black):
        context['_return'] = context['encoded'].black
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].blue):
        context['_return'] = context['encoded'].blue
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].green):
        context['_return'] = context['encoded'].green
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_1):
        context['_return'] = context['encoded'].mix_1
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_2):
        context['_return'] = context['encoded'].mix_2
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_3):
        context['_return'] = context['encoded'].mix_3
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_4):
        context['_return'] = context['encoded'].mix_4
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].red):
        context['_return'] = context['encoded'].red
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].white):
        context['_return'] = context['encoded'].white
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].yellow):
        context['_return'] = context['encoded'].yellow
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Color'] = context['_return']


def ADP_Encode(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: ADP: Message Formats: Encoded
    # VAR_INPUT:
    #   formats: ADP: Message Formats: Decoded
    #   adp_decoded: ADP: Decoded
    #   adp_encoded: ADP: Encoded: Formatting
    # VAR_TEMP:
    #   _ret: ADP: Message Formats: Encoded
    context['_ret'].color = ADP__Encode__Color(color=context['formats'].color, decoded=context['adp_decoded'].color, encoded=context['adp_encoded'].color)
    context['_ret'].flash = ADP__Encode__Flashing(flash=context['formats'].flash, encoded=context['adp_encoded'].flashing, decoded=context['adp_decoded'].flash)
    context['_ret'].horizontal_alignment = ADP__Encode__Horizontal_Alignment(horizontal_alignment=context['formats'].horizontal_alignment, decoded=context['adp_decoded'].horizontal_alignment, encoded=context['adp_encoded'].horizontal_alignment)
    context['_ret'].scroll_speed = ADP__Encode__Scroll_Speed(scroll_speed=context['formats'].scroll_speed, decoded=context['adp_decoded'].scroll_speed, encoded=context['adp_encoded'].scroll_speed)
    context['_ret'].size_and_face = ADP__Encode__Size_and_Face(size_and_face=context['formats'].size_and_face, decoded=context['adp_decoded'].size_and_face, encoded=context['adp_encoded'].size_and_face)
    context['_ret'].vertical_alignment = ADP__Encode__Vertical_Alignment(vertical_alignment=context['formats'].vertical_alignment, decoded=context['adp_decoded'].vertical_alignment, encoded=context['adp_encoded'].vertical_alignment)
    context['ADP: Encode'] = context['_ret']
