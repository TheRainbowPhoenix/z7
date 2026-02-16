import math

def ADP_Encode_Size_and_Face(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   size_and_face: String
    #   decoded: ADP: Decoded: Size and Face
    #   encoded: ADP: Encoded: Formatting: Size and Face
    # VAR_TEMP:
    #   _return: String
    if (context['size_and_face'] == context['decoded'].bold_5):
        context['_return'] = context['encoded'].bold_5
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_11):
        context['_return'] = context['encoded'].bold_11
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_14):
        context['_return'] = context['encoded'].bold_14
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_15):
        context['_return'] = context['encoded'].bold_15
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_16):
        context['_return'] = context['encoded'].bold_16
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_22):
        context['_return'] = context['encoded'].bold_22
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_30):
        context['_return'] = context['encoded'].bold_30
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_32):
        context['_return'] = context['encoded'].bold_32
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].bold_40):
        context['_return'] = context['encoded'].bold_40
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_5):
        context['_return'] = context['encoded'].normal_5
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_7):
        context['_return'] = context['encoded'].normal_7
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_9):
        context['_return'] = context['encoded'].normal_9
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_11):
        context['_return'] = context['encoded'].normal_11
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_14):
        context['_return'] = context['encoded'].normal_14
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_15):
        context['_return'] = context['encoded'].normal_15
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_16):
        context['_return'] = context['encoded'].normal_16
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_22):
        context['_return'] = context['encoded'].normal_22
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_24):
        context['_return'] = context['encoded'].normal_24
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_30):
        context['_return'] = context['encoded'].normal_30
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_32):
        context['_return'] = context['encoded'].normal_32
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['decoded'].normal_40):
        context['_return'] = context['encoded'].normal_40
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Size and Face'] = context['_return']


def ADP_Encode_Horizontal_Alignment(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   horizontal_alignment: String
    #   decoded: ADP: Decoded: Horizontal Alignment
    #   encoded: ADP: Encoded: Formatting: Horizontal Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['horizontal_alignment'] == context['decoded'].center):
        context['_return'] = context['encoded'].center
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].left):
        context['_return'] = context['encoded'].left
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].right):
        context['_return'] = context['encoded'].right
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Horizontal Alignment'] = context['_return']


def ADP_Encode_Scroll_Speed(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   scroll_speed: String
    #   decoded: ADP: Decoded: Scroll Speed
    #   encoded: ADP: Encoded: Formatting: Scroll Speed
    # VAR_TEMP:
    #   _return: String
    if (context['scroll_speed'] == context['decoded'].slowest):
        context['_return'] = context['encoded'].slowest
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].slow):
        context['_return'] = context['encoded'].slow
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].normal):
        context['_return'] = context['encoded'].normal
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fast):
        context['_return'] = context['encoded'].fast
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fastest):
        context['_return'] = context['encoded'].fastest
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Scroll Speed'] = context['_return']


def ADP_Encode_Flashing(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   flash: String
    #   encoded: ADP: Encoded: Formatting: Flashing
    #   decoded: ADP: Decoded: Flash
    # VAR_TEMP:
    #   _return: String
    if (context['flash'] == context['decoded'].off):
        context['_return'] = context['encoded'].off
        # GOTO RTRN (Not supported)
    if (context['flash'] == context['decoded'].on):
        context['_return'] = context['encoded'].on
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Flashing'] = context['_return']


def ADP_Encode_Vertical_Alignment(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   vertical_alignment: String
    #   decoded: ADP: Decoded: Vertical Alignment
    #   encoded: ADP: Encoded: Formatting: Vertical Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['vertical_alignment'] == context['decoded'].bottom_hold):
        context['_return'] = context['encoded'].bottom_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_hold):
        context['_return'] = context['encoded'].fill_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_hold):
        context['_return'] = context['encoded'].middle_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_hold):
        context['_return'] = context['encoded'].top_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].bottom_scroll):
        context['_return'] = context['encoded'].bottom_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_scroll):
        context['_return'] = context['encoded'].fill_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_scroll):
        context['_return'] = context['encoded'].middle_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_scroll):
        context['_return'] = context['encoded'].top_scroll
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Vertical Alignment'] = context['_return']


def ADP_Encode_Color(context, global_dbs):
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
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].blue):
        context['_return'] = context['encoded'].blue
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].green):
        context['_return'] = context['encoded'].green
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_1):
        context['_return'] = context['encoded'].mix_1
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_2):
        context['_return'] = context['encoded'].mix_2
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_3):
        context['_return'] = context['encoded'].mix_3
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_4):
        context['_return'] = context['encoded'].mix_4
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].red):
        context['_return'] = context['encoded'].red
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].white):
        context['_return'] = context['encoded'].white
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].yellow):
        context['_return'] = context['encoded'].yellow
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Color'] = context['_return']


def ADP_Encode(context, global_dbs):
    # Return Type: ADP: Message Formats: Encoded
    # VAR_INPUT:
    #   formats: ADP: Message Formats: Decoded
    #   adp_decoded: ADP: Decoded
    #   adp_encoded: ADP: Encoded: Formatting
    # VAR_TEMP:
    #   _ret: ADP: Message Formats: Encoded
    context['_ret'].color = ADP:_Encode:_Color(color=context['formats'].color, decoded=context['adp_decoded'].color, encoded=context['adp_encoded'].color)
    context['_ret'].flash = ADP:_Encode:_Flashing(flash=context['formats'].flash, encoded=context['adp_encoded'].flashing, decoded=context['adp_decoded'].flash)
    context['_ret'].horizontal_alignment = ADP:_Encode:_Horizontal_Alignment(horizontal_alignment=context['formats'].horizontal_alignment, decoded=context['adp_decoded'].horizontal_alignment, encoded=context['adp_encoded'].horizontal_alignment)
    context['_ret'].scroll_speed = ADP:_Encode:_Scroll_Speed(scroll_speed=context['formats'].scroll_speed, decoded=context['adp_decoded'].scroll_speed, encoded=context['adp_encoded'].scroll_speed)
    context['_ret'].size_and_face = ADP:_Encode:_Size_and_Face(size_and_face=context['formats'].size_and_face, decoded=context['adp_decoded'].size_and_face, encoded=context['adp_encoded'].size_and_face)
    context['_ret'].vertical_alignment = ADP:_Encode:_Vertical_Alignment(vertical_alignment=context['formats'].vertical_alignment, decoded=context['adp_decoded'].vertical_alignment, encoded=context['adp_encoded'].vertical_alignment)
    context['ADP: Encode'] = context['_ret']
