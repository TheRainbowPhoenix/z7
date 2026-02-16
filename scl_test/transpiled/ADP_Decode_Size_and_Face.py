import math

def ADP_Decode_Size_and_Face(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   size_and_face: String
    #   decoded: ADP: Decoded: Size and Face
    #   encoded: ADP: Encoded: Formatting: Size and Face
    # VAR_TEMP:
    #   _return: String
    if (context['size_and_face'] == context['encoded'].bold_5):
        context['_return'] = context['decoded'].bold_5
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_11):
        context['_return'] = context['decoded'].bold_11
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_14):
        context['_return'] = context['decoded'].bold_14
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_15):
        context['_return'] = context['decoded'].bold_15
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_16):
        context['_return'] = context['decoded'].bold_16
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_22):
        context['_return'] = context['decoded'].bold_22
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_30):
        context['_return'] = context['decoded'].bold_30
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_32):
        context['_return'] = context['decoded'].bold_32
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_40):
        context['_return'] = context['decoded'].bold_40
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_5):
        context['_return'] = context['decoded'].normal_5
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_7):
        context['_return'] = context['decoded'].normal_7
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_9):
        context['_return'] = context['decoded'].normal_9
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_11):
        context['_return'] = context['decoded'].normal_11
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_14):
        context['_return'] = context['decoded'].normal_14
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_15):
        context['_return'] = context['decoded'].normal_15
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_16):
        context['_return'] = context['decoded'].normal_16
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_22):
        context['_return'] = context['decoded'].normal_22
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_24):
        context['_return'] = context['decoded'].normal_24
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_30):
        context['_return'] = context['decoded'].normal_30
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_32):
        context['_return'] = context['decoded'].normal_32
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_40):
        context['_return'] = context['decoded'].normal_40
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Size and Face'] = context['_return']
